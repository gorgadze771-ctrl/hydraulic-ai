import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();

// 🔹 ბაზა
const products = JSON.parse(fs.readFileSync("./staloc.json", "utf-8"));

// 🔹 memory
let lastProduct = null;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hydraulic AI running...");
});

// 🔍 FULL SEARCH ყველა ველში
function matchesProduct(p, message) {
  const text = [
    p.name,
    p.code,
    p.simple,
    p.technical,
    p.use,
    p.important,
    ...(p.keywords || [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const words = message.toLowerCase().split(" ");

  return words.some(word => text.includes(word));
}

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const lowerMsg = message.toLowerCase();

    let matches = products.filter(p => matchesProduct(p, lowerMsg));

    // 🔥 თუ რამდენიმე ვარიანტია → დაუსვი კითხვა
    if (matches.length > 1) {
      return res.json({
        reply: "რა სიმტკიცის გინდათ? მაღალი თუ საშუალო."
      });
    }

    let found = matches[0] || null;

    // 🔁 memory fallback
    if (!found && lastProduct) {
      found = lastProduct;
    } else if (found) {
      lastProduct = found;
    }

    let prompt = "";

    if (found) {
      prompt = `
შენ ხარ გამოცდილი ჰიდრავლიკის ტექნიკოსი.

ილაპარაკე როგორც კოლეგასთან:
- მოკლედ
- გამართულად ქართულად
- ბუნებრივად

არ გამოიყენო სლენგი.

ძალიან მნიშვნელოვანია:
- არ მოიგონო არაფერი
- გამოიყენე მხოლოდ მოცემული ინფორმაცია

ინფორმაცია:
პროდუქტი: ${found.name}
კოდი: ${found.code}
მარტივად: ${found.simple}
ტექნიკურად: ${found.technical}
გამოყენება: ${found.use}

უპასუხე მოკლედ.

კითხვა: ${message}
`;
    } else {
      prompt = `
შენ ხარ ჰიდრავლიკის ტექნიკოსი.

უპასუხე მოკლედ.

თუ არ იცი → თქვი "არ ვიცი ზუსტად".

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
      console.error(data);
      return res.status(500).json({ reply: "AI შეცდომა" });
    }

    let reply = "პასუხი ვერ მოიძებნა";

    try {
      if (data.output) {
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
