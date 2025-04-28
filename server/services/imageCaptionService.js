// File: Capstone2025_ISAL/server/services/imageCaptionService.js
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// cho bạn xem token ngay khi file này được load
console.log('Using OpenAI API Key:', process.env.OPENAI_API_KEY);

exports.generateCaptions = async (sources) => {
  // log token mỗi lần gọi service 
  // console.log('Calling OpenAI with token:', process.env.OPENAI_API_KEY);

  // 1) Build prompt + image URLs
  const userContent = [
    {
      type: 'text',
      text: 'Generate a concise caption in English'
    },
    ...sources.map(src => ({
      type: 'image_url',
      image_url: { url: src, detail: 'auto' }
    }))
  ];

  // 2) Call OpenAI chat completion (vision-capable)
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',  // hoặc 'gpt-4-vision-preview'
    messages: [
      { role: 'system', content: 'You are an assistant generating captions for images.' },
      { role: 'user', content: userContent }
    ]
  });

  console.log("Response: ", response);

  // 3) Lấy usage và captions
  const { usage } = response;
  // console.log('OpenAI usage:', usage);

  // 4) Parse raw text thành array captions
  const raw = response.choices[0].message.content;
  console.log(raw);
  const captions = raw
  .split(/\r?\n/)  // tách theo dòng
  .map(line => {
    // Bắt nhóm caption sau số thứ tự, có hoặc không có nháy
    const m = line.match(/^\s*\d+\.\s*["']?(.*?)["']?\s*$/);
    return m ? m[1].trim() : null;
  })
  .filter(Boolean);
  // console.log(res);
  return {captions, usage}
};
