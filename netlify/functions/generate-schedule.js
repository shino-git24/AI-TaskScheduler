// Gemini APIのモデル名
const MODEL_NAME = 'gemini-1.5-flash';

// APIキーはNetlifyの環境変数から取得します
const API_KEY = process.env.GEMINI_API_KEY;

/**
 * Netlify Functionのメインハンドラ
 */
exports.handler = async function(event, context) {
  // APIキーが設定されているか確認
  if (!API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "サーバー側でAPIキーが設定されていません。" }),
    };
  }
  
  // POSTリクエスト以外は拒否
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { rawScheduleText } = JSON.parse(event.body);

    if (!rawScheduleText) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "スケジュールテキストが提供されていません。" }),
      };
    }

    const prompt = `
      You are an assistant that converts raw daily schedule text into a structured JSON format.
      Your output MUST be a JSON array of objects. Each object must have two string properties: "time" and "task".
      For "time", use HH:MM format if a clear time is given (e.g., "9:00", "10:30 AM"). If no specific time is mentioned or it's ambiguous (e.g., "Lunch", "Afternoon break"), use a descriptive placeholder like "指定なし" or "未定".
      For "task", provide a concise description of the activity.

      ユーザー入力例:
      "9時 チーム会議
      10時半 プロジェクトアルファ作業
      昼休み
      14時から クライアントと電話
      夜にプレゼン準備"

      期待されるJSON出力:
      [
        {"time": "09:00", "task": "チーム会議"},
        {"time": "10:30", "task": "プロジェクトアルファ作業"},
        {"time": "指定なし", "task": "昼休み"},
        {"time": "14:00", "task": "クライアントと電話"},
        {"time": "指定なし", "task": "プレゼン準備"}
      ]

      User input:
      "${rawScheduleText}"

      Return ONLY the JSON array. Do not include any other text, explanations, or markdown fences like \`\`\`json. Ensure the output is valid JSON.
    `;

    // Gemini APIへのリクエスト
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                response_mime_type: "application/json",
                temperature: 0.2,
            }
        }),
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        console.error("Gemini API Error:", errorData);
        throw new Error("AIによる解析中にエラーが発生しました。");
    }
    
    const responseData = await response.json();
    const jsonText = responseData.candidates[0].content.parts[0].text;
    const parsedTasks = JSON.parse(jsonText);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tasks: parsedTasks }),
    };

  } catch (error) {
    console.error('Function Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "予期せぬエラーが発生しました。" }),
    };
  }
};
