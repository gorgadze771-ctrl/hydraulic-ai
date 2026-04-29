import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();

// 🔹 ბაზის ჩატვირთვა
const products = JSON.parse(fs.readFileSync("./products.json", "utf-8"));

// 🔹 მარტივი memory (ბოლო ნაპოვნი პროდუქტი)
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

    // 🔁 თუ ვერ იპოვა — გამოიყენე ბოლო პროდუქტი
    if (!found) {
      if (lastProduct) {
        found = lastProduct;
      } else {
        return res.json({
          reply: "ზუსტი ინფორმაცია არ მაქვს ამ თემაზე"
        });
      }
    } else {
      // ✅ თუ იპოვა — დაიმახსოვრე
      lastProduct = found;
    }

    // 🤖 AI პასუხი
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: `
შენ ხარ ჰიდრავლიკის სპეციალისტი.

ძალიან მნიშვნელოვანია:
- არასოდეს მოიგონო ინფორმაცია
- უპასუხე მხოლოდ მოცემულზე დაყრდნობით
- იყავი ბუნებრივი და გასაგები

ინფორმაცია:
მარტივად: ${found.simple}
ტექნიკურად: ${found.technical}
გამოყენება: ${found.use}

თუ მომხმარებელი ითხოვს "უფრო ვრცლად" — გააფართოვე ეს ინფორმაცია.

უპასუხე მოკლედ და ადამიანურად.

კითხვა: ${message}
`
      })
    });

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

    return res.json({ reply });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ reply: "დაფიქსირდა შეცდომა" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
