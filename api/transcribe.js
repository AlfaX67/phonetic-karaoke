import fetch from 'node-fetch';
import OpenAI from 'openai';

const openai = new OpenAI();

export default async function handler(req, res) {
  const video = req.query.video;
  if (!video) return res.status(400).send('Parâmetro video é obrigatório');

  // 1) Puxa transcrição automática em inglês
  const ytUrl = `http://video.google.com/timedtext?lang=en&v=${video}`;
  const ytRes = await fetch(ytUrl);
  const xml   = await ytRes.text();
  const texts = [...xml.matchAll(/<text start="([^"]+)" dur="[^"]*">([^<]+)<\/text>/g)];

  // 2) Monta prompt para OpenAI
  let prompt = `Converta cada linha abaixo para fonética simples em português brasileiro, mantendo o timestamp em segundos:\n`;
  for (let [, start, txt] of texts) {
    prompt += `${start} → ${txt}\n`;
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }]
  });
  const phonetic = completion.choices[0].message.content;

  // 3) Gera WebVTT
  let vtt = 'WEBVTT\n\n';
  phonetic.split('\n').forEach((line, i) => {
    const parts = line.split('→');
    if (parts.length === 2) {
      const sec    = parseFloat(parts[0].trim());
      const mm1    = String(Math.floor(sec / 60)).padStart(2, '0');
      const ss1    = (sec % 60).toFixed(3).padStart(6, '0');
      const start  = `${mm1}:${ss1}`;
      const endSec = sec + 2;
      const mm2    = String(Math.floor(endSec / 60)).padStart(2, '0');
      const ss2    = (endSec % 60).toFixed(3).padStart(6, '0');
      const end    = `${mm2}:${ss2}`;
      vtt += `${i+1}\n${start} --> ${end}\n${parts[1].trim()}\n\n`;
    }
  });

  res.setHeader('Content-Type', 'text/vtt');
  res.send(vtt);
}
