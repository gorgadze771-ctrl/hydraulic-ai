import express from "express";
import cors from "cors";

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hydraulic AI running...");
});

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    const response = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + process.env.OPENAI_API_KEY
  },
  body: JSON.stringify({
    model: "gpt-4.1-mini",
    input: `შენ ხარ ჰიდრავლიკის ექსპერტი.

უპასუხე ბუნებრივად, როგორც ადამიანი.
არ გამოიყენო ფორმალური სტილი.

ჯერ მოკლედ აუხსენი მარტივად (1-2 წინადადება),
შემდეგ სურვილის შემთხვევაში დაამატე ტექნიკური დეტალი (მოკლედ).

არ გამოიყენო "1." და "2." ფორმატი.

კითხვა: ${message}`
  })
});

// 👇 ეს აკლდა შენს კოდს
const data = await response.json();

console.log("OPENAI RESPONSE:", JSON.stringify(data, null, 2));

if (!response.ok) {
  console.error("OPENAI ERROR:", data);
  return res.status(500).json({
    reply: data.error?.message || "AI შეცდომა"
  });
}

let reply = "პასუხი ვერ მოიძებნა";

try {
  if (data.output && data.output.length > 0) {
    for (let item of data.output[0].content) {
      if (item.type === "output_text" && item.text) {
        reply = item.text;
        break;
      }
    }
  }
} catch (e) {
  console.error("PARSE ERROR:", e);
}

res.json({ reply });

  } catch (error) {
    console.error(error);
    res.status(500).json({ reply: "დაფიქსირდა შეცდომა" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
