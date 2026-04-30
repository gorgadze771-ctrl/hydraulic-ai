import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();

// 🔹 ბაზა
const products = JSON.parse(fs.readFileSync("./staloc.json", "utf-8"));

// 🔹 memory
let lastProduct = null;
let pendingFilter = null;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hydraulic AI running...");
});

// 🔍 ტექსტის normalize (typo tolerant)
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/ა/g, "a")
    .replace(/ე/g, "e")
    .replace(/ი/g, "i")
    .replace(/ო/g, "o")
    .replace(/უ/g, "u");
}

// 🔍 სიმტკიცის ამოცნობა
function detectStrength(text) {
  const t = text.toLowerCase();

  // 🔥 მაღალი
  if (
    t.includes("მაღალი") ||
    t.includes("მარალი") ||
    t.includes("მაგალი") ||
    t.includes("magali") ||
    t.includes("maghali") ||
    t.includes("მაღ")
  ) {
    return "მაღალი";
  }

  // 🔥 საშუალო
  if (
    t.includes("საშუალო") ||
    t.includes("საშუალ") ||
    t.includes("sashualo") ||
    t.includes("sashual")
  ) {
    return "საშუალო";
  }

  return null;
}

// 🔍 FULL SEARCH
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

    let matches = [];

    // 🔥 თუ ელოდება სიმტკიცის პასუხს
    if (pendingFilter === "strength") {
      let strength = detectStrength(lowerMsg);

      if (!strength) {
        return res.json({
          reply: "ვერ მივხვდი — მაღალი გინდა თუ საშუალო?"
        });
      }

      matches = products.filter(p =>
        p.simple?.toLowerCase().includes(strength)
      );

      pendingFilter = null;
    }

    // 🔍 ჩვეულებრივი ძებნა
    if (matches.length === 0) {
      matches = products.filter(p => matchesProduct(p, lowerMsg));
    }

    // 🔥 თუ რამდენიმე ვარიანტია → ვკითხოთ
   if (matches.length > 1 && !pendingFilter) {
  pendingFilter = "strength";

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
