require("dotenv").config();
const bcrypt = require("bcrypt");
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const stripe = require("stripe")(process.env.PAYMENT_SECRET);

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.ADMIN_NAME}:${process.env.ADMIN_PASS}@cluster0.egeojdc.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
const db = client.db("digitalLifeLessons");
const usersCollection = db.collection("users");
const lessonsCollection = db.collection("lessons");
const lessonsReportsCollection = db.collection("lessonsReports");
const paymentsCollection = db.collection("payments");
const favoritesCollection = db.collection("favorites");
const commentsCollection = db.collection("comments");

async function run() {
  try {
    await client.connect();
    console.log("✅ MongoDB connected");

    // save users to DB
    app.post("/users", async (req, res) => {
      try {
        const { password, ...data } = req.body;

        const saltRounds = 10;
        const salt = await bcrypt.genSalt(saltRounds);

        const hashedPassword = await bcrypt.hash(password, salt);

        const result = await usersCollection.insertOne({
          ...data,
          password: hashedPassword,
        });
        res.status(201).send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to add user" });
      }
    });
  } catch (error) {
    console.error(error);
  }

  // check bcrypt password while login
  app.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await usersCollection.findOne({ email });

      if (!user) return res.status(404).send({ message: "User not found" });

      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).send({ message: "Wrong password" });

      res.send({ message: "Login successful", user });
    } catch (err) {
      console.error(err);
      res.status(500).send({ message: "Login failed" });
    }
  });
  // add google user to DB
  app.post("/users/google", async (req, res) => {
    try {
      const { email } = req.body;

      //  check existing user
      const existingUser = await usersCollection.findOne({ email });

      if (existingUser) {
        return res.send({ message: "User already exists", user: existingUser });
      }

      //  insert google user (NO password)
      const result = await usersCollection.insertOne(req.body);

      res.status(201).send(result);
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Google user save failed" });
    }
  });
  // existing user check
  app.get("/users", async (req, res) => {
    const { email } = req.body;
    const existingEmail = usersCollection.findOne({ email });
    if (existingEmail) {
      return res.send({ message: "User already exists" });
    }
    const result = await usersCollection.insertOne(req.body);
    res.send(result);
  });
  // add lessons
  app.post("/lessons", async (req, res) => {
    try {
      const data = req.body;
      const result = await lessonsCollection.insertOne(data);
      res.status(201).send(result);
    } catch (err) {
      console.error(err);
      res.status(500).send({ message: "Failed to add lesson" });
    }
  });

  // payment related apis
  app.post("/create-checkout-session", async (req, res) => {
    const paymentInfo = req.body;
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: 12.27 * 100,
            product_data: {
              name: "Premium Plan",
            },
          },
          quantity: 1,
        },
      ],
      customer_email: paymentInfo.userEmail,
      mode: "payment",
      success_url: `${process.env.SITE_DOMAIN}/dashboard/paymentSuccess`,
      cancel_url: `${process.env.SITE_DOMAIN}/dashboard/paymentCancel`,
    });

    res.json({ url: session.url });
  });
}
run();

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
