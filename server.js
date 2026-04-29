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
უპასუხე ორ დონეზე:
1. მარტივად (უბრალო ადამიანისთვის)
2. ტექნიკურად (სპეციალისტისთვის)

კითხვა: ${message}`
      })
    });

    const data = await response.json();

    // სწორი პასუხის ამოღება
    let reply = "პასუხი ვერ მოიძებნა";

    if (data.output && data.output.length > 0) {
      const content = data.output[0].content;

      if (content && content.length > 0 && content[0].text) {
        reply = content[0].text;
      }
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
