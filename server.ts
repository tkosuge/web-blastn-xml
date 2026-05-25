import express from 'express';
import path from 'path';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import { XMLParser } from 'fast-xml-parser';

const app = express();
const PORT = 3000;

// Setup Multer for sequence uploads limit 20MB
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// Setup SQLite db
const dbPath = path.join(process.cwd(), 'blast_results.sqlite');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    status TEXT,
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT,
    iteration_num INTEGER,
    query_id TEXT,
    query_def TEXT,
    query_len INTEGER,
    FOREIGN KEY(job_id) REFERENCES jobs(id)
  );
  CREATE TABLE IF NOT EXISTS hits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_id INTEGER,
    hit_num INTEGER,
    hit_id TEXT,
    hit_def TEXT,
    hit_len INTEGER,
    FOREIGN KEY(query_id) REFERENCES queries(id)
  );
  CREATE TABLE IF NOT EXISTS hsps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hit_id INTEGER,
    hsp_num INTEGER,
    bit_score REAL,
    evalue REAL,
    query_from INTEGER,
    query_to INTEGER,
    hit_from INTEGER,
    hit_to INTEGER,
    identity INTEGER,
    align_len INTEGER,
    qseq TEXT,
    hseq TEXT,
    midline TEXT,
    is_plus INTEGER,
    FOREIGN KEY(hit_id) REFERENCES hits(id)
  );
`);

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.post('/api/blast', upload.single('sequenceFile'), async (req, res) => {
  try {
    let sequenceData = Array.isArray(req.body.sequenceText) 
      ? req.body.sequenceText[0] 
      : req.body.sequenceText;
      
    if (typeof sequenceData !== 'string') {
      sequenceData = sequenceData ? String(sequenceData) : '';
    }

    const {
      task = 'megablast',
      evalue = '1e-5',
      db: blastDb = 'core_nt',
      taxid = '',
      num_alignments = '10',
      align_width = '60',
      downloadOnly = 'false'
    } = req.body;

    if (req.file) {
      sequenceData = fs.readFileSync(req.file.path, 'utf8');
      fs.unlinkSync(req.file.path);
    }

    if (!sequenceData || sequenceData.trim() === '') {
      return res.status(400).json({ error: 'No sequence provided.' });
    }

    if (Buffer.byteLength(sequenceData, 'utf8') > 20 * 1024 * 1024) {
      return res.status(400).json({ error: 'Sequence exceeds 20MB limit.' });
    }

    const jobId = uuidv4();
    db.prepare('INSERT INTO jobs (id, status) VALUES (?, ?)').run(jobId, 'running');

    res.json({ jobId, message: 'BLAST job is running' });

    // Background processing
    (async () => {
      const inputFastaPath = path.join(os.tmpdir(), `blast_input_${jobId}.fasta`);
      const outputXmlPath = path.join(os.tmpdir(), `blast_output_${jobId}.xml`);
      
      try {
        fs.writeFileSync(inputFastaPath, sequenceData);

        const blastArgs = [
          '-num_threads', '8',
          '-task', task,
          '-query', inputFastaPath,
          '-db', blastDb,
          '-outfmt', '5',
          '-num_alignments', String(num_alignments),
          '-evalue', String(evalue),
          '-out', outputXmlPath
        ];

        if (taxid.trim()) {
          blastArgs.push('-taxids', taxid.trim());
        }

        const blastProcess = spawn('blastn', blastArgs);

        let sizeExceeded = false;
        const resultLimit = downloadOnly === 'true' ? 1024 * 1024 * 1024 : 100 * 1024 * 1024;

        // Monitor file size
        const intervalId = setInterval(() => {
          if (fs.existsSync(outputXmlPath)) {
            const stats = fs.statSync(outputXmlPath);
            if (stats.size > resultLimit) {
              sizeExceeded = true;
              blastProcess.kill();
              clearInterval(intervalId);
            }
          }
        }, 1000);

        blastProcess.on('close', (code) => {
          clearInterval(intervalId);
          if (sizeExceeded) {
             db.prepare('UPDATE jobs SET status = ?, error = ? WHERE id = ?').run('error', `The result size exceeds the limit of ${downloadOnly === 'true' ? '1GB' : '100MB'}.`, jobId);
             return cleanUp();
          }
          if (code !== 0) {
             db.prepare('UPDATE jobs SET status = ?, error = ? WHERE id = ?').run('error', `blastn failed with exit code ${code}`, jobId);
             return cleanUp();
          }

          try {
            const xmlData = fs.readFileSync(outputXmlPath, 'utf8');
            
            // if download only, we don't parse it into SQLite deeply or maybe we just store the file?
            // The requirement says "結果をスクリーンに表示せずにダウンロードのみにする". So we still need to provide the XML file to download.
            // But we don't need to insert huge amounts of data to SQLite if it's download only.
            
            if (downloadOnly === 'true') {
              // We can just keep the file and mark job as download_ready
              db.prepare('UPDATE jobs SET status = ? WHERE id = ?').run('download_ready', jobId);
            } else {
              // Parse XML and save to SQLite
              const parser = new XMLParser({
                ignoreAttributes: false,
                isArray: (name) => { 
                  return ['Iteration', 'Hit', 'Hsp'].includes(name);
                }
              });
              const jsonObj = parser.parse(xmlData);
              
              const iterations = jsonObj?.BlastOutput?.BlastOutput_iterations?.Iteration || [];
              
              db.transaction(() => {
                for (const iter of iterations) {
                  const qResult = db.prepare('INSERT INTO queries (job_id, iteration_num, query_id, query_def, query_len) VALUES (?, ?, ?, ?, ?)')
                    .run(jobId, iter['Iteration_iter-num'], iter['Iteration_query-ID'], iter['Iteration_query-def'], iter['Iteration_query-len']);
                  const queryDbId = qResult.lastInsertRowid;
                  
                  const hits = iter?.Iteration_hits?.Hit || [];
                  for (const hit of hits) {
                    const hResult = db.prepare('INSERT INTO hits (query_id, hit_num, hit_id, hit_def, hit_len) VALUES (?, ?, ?, ?, ?)')
                      .run(queryDbId, hit['Hit_num'], hit['Hit_id'], hit['Hit_def'], hit['Hit_len']);
                    const hitDbId = hResult.lastInsertRowid;
                    
                    const hsps = hit?.Hit_hsps?.Hsp || [];
                    for (const hsp of hsps) {
                       const hitFrom = Number(hsp['Hsp_hit-from']);
                       const hitTo = Number(hsp['Hsp_hit-to']);
                       const isPlus = (hitTo - hitFrom) > 0 ? 1 : 0;
                       db.prepare(`INSERT INTO hsps (hit_id, hsp_num, bit_score, evalue, query_from, query_to, hit_from, hit_to, identity, align_len, qseq, hseq, midline, is_plus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                         .run(hitDbId, hsp['Hsp_num'], hsp['Hsp_bit-score'], hsp['Hsp_evalue'], hsp['Hsp_query-from'], hsp['Hsp_query-to'], hitFrom, hitTo, hsp['Hsp_identity'], hsp['Hsp_align-len'], hsp['Hsp_qseq'], hsp['Hsp_hseq'], hsp['Hsp_midline'], isPlus);
                    }
                  }
                }
              })();

              db.prepare('UPDATE jobs SET status = ? WHERE id = ?').run('completed', jobId);
            }
          } catch (err: any) {
             db.prepare('UPDATE jobs SET status = ?, error = ? WHERE id = ?').run('error', err.message, jobId);
          } finally {
             cleanUp();
          }
        });

        blastProcess.on('error', (err) => {
           clearInterval(intervalId);
           db.prepare('UPDATE jobs SET status = ?, error = ? WHERE id = ?').run('error', 'blastn command execution failed: ' + err.message, jobId);
           cleanUp();
        });

        function cleanUp() {
          try { if (fs.existsSync(inputFastaPath)) fs.unlinkSync(inputFastaPath); } catch (e) { }
          // keeping outputXmlPath so user can download it
        }

      } catch(e: any) {
        db.prepare('UPDATE jobs SET status = ?, error = ? WHERE id = ?').run('error', e.message, jobId);
      }
    })();

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/jobs/:id', (req, res) => {
  try {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/jobs/:id/queries', (req, res) => {
  try {
    const queries = db.prepare('SELECT id, query_id, query_def, query_len FROM queries WHERE job_id = ?').all(req.params.id);
    res.json(queries);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/queries/:queryId/hits', (req, res) => {
  try {
    const queryId = req.params.queryId;
    const hits = db.prepare('SELECT h.* FROM hits h WHERE h.query_id = ?').all(queryId);
    
    for (let hit of hits as any[]) {
      const hsps = db.prepare('SELECT * FROM hsps WHERE hit_id = ?').all(hit.id);
      hit.hsps = hsps;
    }
    
    // get query_len to pass down
    const query = db.prepare('SELECT query_len FROM queries WHERE id = ?').get(queryId) as any;
    res.json({ hits, query_len: query?.query_len });
  } catch(err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/jobs/:id/download', (req, res) => {
  const jobId = req.params.id;
  const outputXmlPath = path.join(os.tmpdir(), `blast_output_${jobId}.xml`);
  if (fs.existsSync(outputXmlPath)) {
    res.download(outputXmlPath, `blast_result_${jobId}.xml`);
  } else {
    // If it's a completed job but we didn't save the file (or deleted it), we might not have it.
    // Wait, the requirement says "Downloadボタンをクリックしたときに、xml形式の結果でダウンロード可能に".
    // I should save the XML file to database or keep it in temp dir so it can be downloaded.
    // Let's modify the process to always keep the xml file.
    res.status(404).json({ error: 'File not found or expired.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
