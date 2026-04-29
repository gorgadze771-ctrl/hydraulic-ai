import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();

// 🔹 ბაზა
const products = JSON.parse(fs.readFileSync("./products.json", "utf-8"));

// 🔹 memory
let lastProduct = null;

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

    let found = products.find(p =>
      p.keywords.some(k =>
        message.toLowerCase().includes(k.toLowerCase())
      )
    );

    // 🔁 memory
    if (!found) {
      if (lastProduct) {
        found = lastProduct;
      }
    } else {
      lastProduct = found;
    }

    let prompt = "";

    if (found) {
      prompt = `
შენ ხარ გამოცდილი ჰიდრავლიკის ტექნიკოსი.

ილაპარაკე როგორც კოლეგასთან:
- ბუნებრივად და მოკლედ
- გამართულად ქართულად
- პროფესიონალურად, მაგრამ მარტივად
- წინადადებები იყოს სუფთა და გასაგები

არ გამოიყენო სლენგი, ჟარგონი ან არასწორი ფორმულირება.
არ ილაპარაკო ზედმეტად “საკლასო” ან წიგნური სტილით.

ძალიან მნიშვნელოვანია:
- არ მოიგონო ინფორმაცია
- გამოიყენე მხოლოდ მოცემული მონაცემი
- აუცილებლად დაასახელე პროდუქტის სახელი

ინფორმაცია:
პროდუქტი: ${found.name}
მარტივად: ${found.simple}
ტექნიკურად: ${found.technical}
გამოყენება: ${found.use}

უპასუხე მოკლედ (1-2 წინადადება), ისე როგორც თანამშრომელს აუხსნიდი.

კითხვა: ${message}
`;
    } else {
      // 🔹 fallback (თუ ბაზაში ვერ იპოვა)
      prompt = `
შენ ხარ ჰიდრავლიკის ხელოსანი.

უპასუხე მოკლედ და ადამიანურად.

თუ ზუსტად არ იცი → თქვი "არ ვიცი ზუსტად".

კითხვა: ${message}
`;
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt
      })
    });

    const data = await response.json();

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
          if (item.type === "output_text") {
            reply = item.text;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
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
