import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();

// 🔹 ბაზა
const products = JSON.parse(fs.readFileSync("./staloc.json", "utf-8"));

// 🔹 memory
let lastProduct = null;
let pendingFilter = null;
let pendingMatches = [];

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hydraulic AI running...");
});

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

// 🔍 განსხვავების პოვნა
function findDifference(matches) {
  const strengths = new Set();

  matches.forEach(p => {
    if (p.simple?.includes("მაღალი")) strengths.add("მაღალი");
    if (p.simple?.includes("საშუალო")) strengths.add("საშუალო");
  });

  if (strengths.size > 1) {
    return {
      type: "strength",
      question: "მაღალი გინდა თუ საშუალო?"
    };
  }

  return null;
}

// 🔍 სიმტკიცის ამოცნობა
function detectStrength(text) {
  const t = text.toLowerCase();

  if (
    t.includes("მაღალი") ||
    t.includes("მარალი") ||
    t.includes("მაგალი") ||
    t.includes("magali") ||
    t.includes("მაღ")
  ) return "მაღალი";

  if (
    t.includes("საშუალო") ||
    t.includes("საშუალ")
  ) return "საშუალო";

  return null;
}

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const lowerMsg = message.toLowerCase();

    let matches = [];

    // 🔥 პასუხი წინა კითხვაზე
    if (pendingFilter === "strength") {
      const strength = detectStrength(lowerMsg);

      if (strength) {
        matches = pendingMatches.filter(p =>
          p.simple?.toLowerCase().includes(strength)
        );
      } else {
        matches = pendingMatches;
      }

      pendingFilter = null;
      pendingMatches = [];
    }

    // 🔍 ჩვეულებრივი ძებნა
    if (matches.length === 0) {
      matches = products.filter(p => matchesProduct(p, lowerMsg));
    }

    // 🔥 თუ რამდენიმეა → დავუსვათ სწორი კითხვა
    if (matches.length > 1 && !pendingFilter) {
      const diff = findDifference(matches);

      if (diff) {
        pendingFilter = diff.type;
        pendingMatches = matches;

        return res.json({ reply: diff.question });
      }
    }

    let found = matches[0] || null;

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

არ მოიგონო ინფორმაცია.

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
    } catch (e) {}

    res.json({ reply });

  } catch (error) {
    console.error(error);
    res.status(500).json({ reply: "შეცდომა" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
