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
      あなたは熟練のAIスケジュールアシスタントです。ユーザーが提供するタスクリストに基づいて、詳細な一日のスケジュールを作成することがあなたの役割です。

      **スケジューリングのルールと制約:**
      1.  **稼働時間:** 勤務日は09:00から18:00までとします。
      2.  **固定スケジュール:**
          - **朝の準備:** 09:00 - 09:30 は常に「メール対応等」に割り当てます。
          - **昼休み:** 12:00 - 13:00 は常に「昼休み」に割り当てます。
      3.  **タスク入力:** ユーザーは特定の時間（例：「14:00 クライアント会議」）や所要時間（例：「レポート作成 2時間」、「資料確認 30分」）でタスクを指示できます。
      4.  **スケジューリングロジック:**
          - ユーザータスクは、利用可能な時間帯（09:30-12:00 および 13:00-18:00）に配置してください。
          - タスクの所要時間が1時間を超える場合は、1時間単位のチャンクに分割してください。（例：2時間半のタスクは、1時間のタスク2つと30分のタスク1つになります）。分割した場合はタスク名に「(1/2)」のように追記してください。
          - スケジュールが許す限り、タスク間に短い休憩時間（例：5分～15分）を設けて、ゆとりのある計画を作成してください。
          - **順序の維持:** 関連性のあるタスク（例：「物件A 資料作成」、「物件A 電話連絡」）が連続している場合、その相対的な順序は変更しないでください。
          - **優先順位:** ユーザーが「最優先：」などで優先度を指定した場合、そのタスクを可能な限り早くスケジュールしてください。
      5.  **出力フォーマット:** 出力は、オブジェクトのJSON配列でなければなりません。各オブジェクトには以下のプロパティが必要です。
          - \`startTime\`: タスクの開始時間を "HH:MM" 形式の文字列で指定します。
          - \`endTime\`: タスクの終了時間を "HH:MM" 形式の文字列で指定します。
          - \`task\`: タスクの簡潔な説明を文字列で指定します。
          - \`remarks\`: タスクが分割された場合や優先事項であるなど、補足情報があれば文字列で指定します。該当しない場合は空文字列 "" にしてください。

      **ユーザー入力の例:**
      "最優先：クライアントAへの提案書作成 2時間。資料Bのレビュー 1時間。チーム内でのブレスト 30分。16時に定例会議。"

      **期待されるJSON出力の例:**
      [
        {"startTime": "09:00", "endTime": "09:30", "task": "メール対応等", "remarks": ""},
        {"startTime": "09:30", "endTime": "10:30", "task": "クライアントAへの提案書作成 (1/2)", "remarks": "最優先タスク"},
        {"startTime": "10:30", "endTime": "11:30", "task": "クライアントAへの提案書作成 (2/2)", "remarks": "最優先タスク"},
        {"startTime": "11:30", "endTime": "12:00", "task": "チーム内でのブレスト", "remarks": ""},
        {"startTime": "12:00", "endTime": "13:00", "task": "昼休み", "remarks": ""},
        {"startTime": "13:00", "endTime": "14:00", "task": "資料Bのレビュー", "remarks": ""},
        {"startTime": "14:00", "endTime": "16:00", "task": "（バッファ・移動時間）", "remarks": "空き時間"},
        {"startTime": "16:00", "endTime": "17:00", "task": "定例会議", "remarks": "時間指定あり"},
        {"startTime": "17:00", "endTime": "18:00", "task": "（残務処理・翌日準備）", "remarks": "空き時間"}
      ]

      **重要:**
      - 最終的なスケジュールには、必ず朝の準備と昼休みを含めてください。
      - スケジュールに空き時間がある場合は、「（休憩）」や「（バッファ）」のような汎用的なタスクで埋めてください。
      - 出力はJSON配列そのものだけにしてください。\`\`\`jsonのようなマークダウンフェンスや、その他の説明文は含めないでください。

      **処理するユーザー入力:**
      "${rawScheduleText}"
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
    // JSONパースエラーなども考慮
    if (error instanceof SyntaxError) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "AIからの応答形式が正しくありません。もう一度お試しください。" }),
        };
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "予期せぬエラーが発生しました。" }),
    };
  }
};