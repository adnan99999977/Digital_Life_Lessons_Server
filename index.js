require("dotenv").config();
const bcrypt = require("bcrypt");
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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

  // USERS API'S

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

  // Get user(s)
  app.get("/users", async (req, res) => {
    try {
      const { email } = req.query;

      if (email) {
        // Fetch single user by email
        const user = await usersCollection.findOne({ email });
        if (!user) return res.status(404).send({ message: "User not found" });
        return res.send(user);
      }

      // If no email, fetch all users
      const users = await usersCollection.find().toArray();
      res.send(users);
    } catch (err) {
      console.error(err);
      res.status(500).send({ message: "Failed to fetch user(s)" });
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

  // =================================================

  // LESSONS API'S

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

  // get all lessons
  app.get("/lessons", async (req, res) => {
    try {
      const { email } = req.query;

      let query = {};

      if (email) {
        query = { creatorEmail: email };
      }

      const lessons = await lessonsCollection.find(query).toArray();
      res.send(lessons);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch lessons" });
    }
  });

  // get lesson by id
  app.get("/lessons/:id", async (req, res) => {
    const { id } = req.params;
    const lesson = await lessonsCollection.findOne({
      _id: new ObjectId(id),
    });
    res.send(lesson);
  });
  // get lesson by /lessons/featured
  app.get("/lessons/featured", async (req, res) => {
    try {
      const lessons = await Lesson.find({ featured: true });
      res.status(200).json(lessons);
    } catch (err) {
      console.error("Failed to get featured lessons:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // get lesson by top-contributors
  app.get("/users/top-contributors", async (req, res) => {
    try {
      // Example: get top 4 users by lessons contributed
      const contributors = await User.find()
        .sort({ lessonsContributed: -1 })
        .limit(4);
      res.status(200).json(contributors);
    } catch (err) {
      console.error("Failed to get top contributors:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  // get lesson by most-saved
  app.get("/lessons/most-saved", async (req, res) => {
    try {
      const lessons = await Lesson.find().sort({ savedCount: -1 }).limit(6);
      res.status(200).json(lessons);
    } catch (err) {
      console.error("Failed to get most saved lessons:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // =================================================
  // COMMENTS APIS

  // post comment
  app.post("/comments", async (req, res) => {
    try {
      const data = req.body;
      const result = await commentsCollection.insertOne(data);
      res.status(201).send(result);
    } catch (err) {
      console.error(err);
      res.status(500).send({ message: "Failed to add comment" });
    }
  });

  // get comment
  app.get("/comments", async (req, res) => {
    try {
      const data = req.body;
      const comments = await commentsCollection.find(data).toArray();
      res.status(201).send(comments);
    } catch (err) {
      console.error(err);
      res.status(500).send({ message: "Failed to get comments" });
    }
  });

  // =================================================
  // FAVORITE APIs
  app.post("/favorites", async (req, res) => {
    try {
      const data = req.body;
      const result = await favoritesCollection.insertOne(data);
      res.status(201).send(result);
    } catch (err) {
      console.error(err);
      res.status(500).send({ message: "Failed to add favorites" });
    }
  });

  app.get("/favorites", async (req, res) => {
    try {
      const data = req.body;
      const favorites = await favoritesCollection.find(data).toArray();
      res.status(201).send(favorites);
    } catch (err) {
      console.error(err);
      res.status(500).send({ message: "Failed to get favorites" });
    }
  });

  // =================================================
  // PAYMENTS APIS

  app.post("/create-checkout-session", async (req, res) => {
    const paymentInfo = req.body;
    const amount = Math.floor(11.801 * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amount,
            product_data: {
              name: "Premium Plan",
              description: "Access to Premium Lessons on Life Lessons Platform",
            },
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: paymentInfo.userEmail,
      metadata: {
        userId: paymentInfo.userId,
        plan: "Premium",
      },
      success_url: `${process.env.SITE_DOMAIN}/dashboard/paymentSuccess?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_DOMAIN}/dashboard/paymentCancel`,
    });

    res.json({ url: session.url });
  });

  app.get("/payment-success", async (req, res) => {
    const sessionId = req.query.session_id;
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const userEmail = session.customer_email;

      const result = await usersCollection.findOneAndUpdate(
        { email: userEmail },
        { $set: { plan: "Premium", isPremium: true } },
        { returnDocument: "after" }
      );

      res.json({
        message: "Payment successful, user upgraded",
        user: result.value,
        amount: session.amount_total / 100,
        plan: "Premium",
        transactionId: session.payment_intent,
        userEmail: userEmail,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Unable to retrieve session" });
    }
  });
}
run();

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
