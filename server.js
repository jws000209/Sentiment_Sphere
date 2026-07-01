import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Key 검증
const openAiKey = process.env.OPENAI_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let openai = null;
let supabase = null;

if (openAiKey && openAiKey !== 'your_openai_api_key_here') {
  openai = new OpenAI({ apiKey: openAiKey });
}

if (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'your_supabase_url_here' && supabaseAnonKey !== 'your_supabase_anon_key_here') {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

// 1. 감성 분석 API
app.post('/api/analyze', async (req, res) => {
  const { text } = req.body;

  // 1.1 입력 검증
  if (!text || text.trim() === '') {
    return res.status(400).json({ error: '텍스트를 입력해주세요.' });
  }

  if (text.length > 1000) {
    return res.status(400).json({ error: '최대 1000자까지만 분석 가능합니다.' });
  }

  // 1.2 OpenAI API 키 검증 및 호출
  if (!openai) {
    return res.status(500).json({ error: 'OpenAI API 키가 설정되지 않았습니다. .env 파일을 확인해 주세요.' });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '너는 제공된 텍스트의 감성을 정확히 분석하는 AI다. 반드시 다음 JSON 형식으로만 답해라. JSON 외에 다른 설명이나 마크다운 백틱(```json)을 포함하지 말아라. \nFormat: {"emotion": "긍정" | "부정" | "중립", "confidence": <0~100 사이의 정수>, "reason": "<분석 이유를 한국어로 1~2문장 요약>"}'
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const resultText = response.choices[0].message.content.trim();
    const result = JSON.parse(resultText);

    // 응답 스키마 정합성 보장
    const emotion = result.emotion || '중립';
    const confidence = Number(result.confidence) || 50;
    const reason = result.reason || '감성을 판단하기 모호합니다.';

    // 1.3 Supabase DB 저장 (설정되어 있을 경우)
    if (supabase) {
      const { error: dbError } = await supabase
        .from('analysis_history')
        .insert([{
          text: text,
          emotion: emotion,
          confidence: confidence,
          reason: reason
        }]);

      if (dbError) {
        console.error('Supabase DB 저장 에러:', dbError.message);
      }
    } else {
      console.warn('Supabase 클라이언트가 초기화되지 않아 히스토리를 저장하지 못했습니다.');
    }

    return res.json({ emotion, confidence, reason });
  } catch (error) {
    console.error('감성 분석 중 에러 발생:', error);
    return res.status(500).json({ error: '감성 분석 수행 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
  }
});

// 2. 분석 이력 조회 API
app.get('/api/history', async (req, res) => {
  if (!supabase) {
    // DB 설정이 안 되어 있으면 빈 배열 반환하여 클라이언트 에러를 방지함
    return res.json([]);
  }

  try {
    const { data, error } = await supabase
      .from('analysis_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10); // 최근 10개만 조회

    if (error) {
      throw error;
    }

    return res.json(data || []);
  } catch (error) {
    console.error('이력 조회 에러:', error.message);
    return res.status(500).json({ error: '분석 이력을 조회하지 못했습니다.' });
  }
});

// 3. 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 작동 중입니다.`);
});
