require("dotenv").config();
const bcrypt = require("bcrypt");
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.PAYMENT_SECRET);

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

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

  app.get("/users/:id", async (req, res) => {
    const { id } = req.params;

    try {
      const user = await usersCollection.findOne({ _id: new ObjectId(id) });
      if (!user) return res.status(404).send({ message: "User not found" });

      res.send(user);
    } catch (err) {
      console.error(err);
      res.status(500).send({ message: "Failed to fetch user" });
    }
  });

  app.get("/users", async (req, res) => {
    try {
      const { email } = req.query;

      // single user by email
      if (email) {
        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }
        return res.send(user);
      }

      // all users
      const users = await usersCollection.find().toArray();
      res.send(users);
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Failed to fetch user(s)" });
    }
  });

  app.post("/users", async (req, res) => {
    try {
      const user = req.body;

      if (!user?.email) {
        return res.status(400).send({ message: "Email is required" });
      }

      const existingUser = await usersCollection.findOne({
        email: user.email,
      });

      if (existingUser) {
        return res.send({ message: "User already exists", inserted: false });
      }

      const result = await usersCollection.insertOne(user);
      res.status(201).send({
        message: "User created successfully",
        inserted: true,
        result,
      });
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Failed to create user" });
    }
  });

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

  app.patch("/users/:id", async (req, res) => {
    const userId = req.params.id;
    const updateData = req.body;

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: "User not found" });
    }

    const updatedUser = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    res.send(updatedUser);
  });

  app.delete("/users/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });

      if (result.deletedCount === 1) {
        return res.status(200).send({
          success: true,
          message: "User deleted successfully",
        });
      }

      res.status(404).send({
        success: false,
        message: "User not found",
      });
    } catch (err) {
      console.error("Delete user error:", err);
      res.status(500).send({
        success: false,
        message: "Failed to delete user",
      });
    }
  });

  // =================================================

  // LESSONS API'S

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

  app.patch("/lessons/:id", async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    try {
      if (!ObjectId.isValid(id))
        return res.status(400).send({ message: "Invalid lesson ID" });

      const lesson = await lessonsCollection.findOne({ _id: new ObjectId(id) });
      if (!lesson) return res.status(404).send({ message: "Lesson not found" });

      // Update
      await lessonsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );

      // Fetch updated lesson
      const updatedLesson = await lessonsCollection.findOne({
        _id: new ObjectId(id),
      });

      res.status(200).send(updatedLesson); // ✅ now defined
    } catch (err) {
      console.error("Update lesson error:", err);
      res
        .status(500)
        .send({ message: "Failed to update lesson", error: err.message });
    }
  });

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

  app.get("/lessons/:id", async (req, res) => {
    const { id } = req.params;
    const lesson = await lessonsCollection.findOne({
      _id: new ObjectId(id),
    });
    res.send(lesson);
  });

  app.get("/lessons/featured", async (req, res) => {
    try {
      const lessons = await Lesson.find({ featured: true });
      res.status(200).json(lessons);
    } catch (err) {
      console.error("Failed to get featured lessons:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/lessons/most-saved", async (req, res) => {
    try {
      const lessons = await Lesson.find().sort({ savedCount: -1 }).limit(6);
      res.status(200).json(lessons);
    } catch (err) {
      console.error("Failed to get most saved lessons:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/lessons/:id/favorite", async (req, res) => {
    const { id } = req.params;
    try {
      const result = await lessonsCollection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $inc: { favoritesCount: 1 } },
        { returnDocument: "after" } // ensures updated lesson is returned
      );
      res.status(200).send(result.value);
    } catch (err) {
      res.status(500).send({ message: "Failed to favorite" });
    }
  });

  app.patch("/lessons/:id/like", async (req, res) => {
    const { id } = req.params;
    try {
      const result = await lessonsCollection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $inc: { likesCount: 1 } },
        { returnDocument: "after" }
      );
      res.status(200).send(result.value);
    } catch (err) {
      res.status(500).send({ message: "Failed to like" });
    }
  });

  // Toggle visibility
  app.patch("/lessons/:id/toggle-visibility", async (req, res) => {
    const id = req.params.id;
    try {
      if (!ObjectId.isValid(id))
        return res.status(400).send({ message: "Invalid ID" });

      const lesson = await lessonsCollection.findOne({ _id: new ObjectId(id) });
      if (!lesson) return res.status(404).send({ message: "Lesson not found" });

      const currentVisibility =
        (lesson.visibility || "Public") === "Public" ? "Private" : "Public";

      const result = await lessonsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { visibility: currentVisibility } }
      );

      res.send(result);
    } catch (err) {
      console.error("Toggle visibility error:", err);
      res.status(500).send({ message: "Server error", error: err.message });
    }
  });

  // Toggle access
  app.patch("/lessons/:id/toggle-access", async (req, res) => {
    const id = req.params.id;
    try {
      if (!ObjectId.isValid(id))
        return res.status(400).send({ message: "Invalid ID" });

      const lesson = await lessonsCollection.findOne({ _id: new ObjectId(id) });
      if (!lesson) return res.status(404).send({ message: "Lesson not found" });

      const newAccess =
        (lesson.accessLevel || "Free") === "Free" ? "Premium" : "Free";

      const result = await lessonsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { accessLevel: newAccess } }
      );

      res.send(result);
    } catch (err) {
      console.error("Toggle access error:", err);
      res.status(500).send({ message: "Server error", error: err.message });
    }
  });

  app.patch("/lessons/:id/view", async (req, res) => {
    const { id } = req.params;
    try {
      const result = await lessonsCollection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $inc: { viewsCount: 1 } },
        { returnDocument: "after" }
      );
      res.status(200).send(result.value);
    } catch (err) {
      res.status(500).send({ message: "Failed to increment views" });
    }
  });

  app.delete("/lessons/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const result = await lessonsCollection.deleteOne({
        _id: new ObjectId(id),
      });

      if (result.deletedCount === 1) {
        return res.status(200).send({
          success: true,
          message: "lessons item deleted successfully",
        });
      }
      res.status(404).send({
        success: false,
        message: "lessons item not found",
      });
    } catch (err) {
      console.error("Delete lessons error:", err);
      res.status(500).send({
        success: false,
        message: "Failed to delete lessons item",
      });
    }
  });

  // =================================================
  // COMMENTS APIS

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

  app.get("/comments", async (req, res) => {
    try {
      const { lessonId } = req.query; // Get lessonId from URL query
      if (!lessonId)
        return res.status(400).send({ message: "lessonId is required" });

      const comments = await commentsCollection.find({ lessonId }).toArray();
      res.status(200).send(comments); // ✅ Only comments for this lesson
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

  app.delete("/favorites/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const result = await favoritesCollection.deleteOne({
        _id: new ObjectId(id),
      });

      if (result.deletedCount === 1) {
        return res.status(200).send({
          success: true,
          message: "Favorite item deleted successfully",
        });
      }
      res.status(404).send({
        success: false,
        message: "Favorite item not found",
      });
    } catch (err) {
      console.error("Delete favorite error:", err);
      res.status(500).send({
        success: false,
        message: "Failed to delete favorite item",
      });
    }
  });

  // =================================================
  //  REPORTED APIS
  // ==================== REPORTED LESSONS APIs ====================
  app.post("/lessonsReports", async (req, res) => {
    try {
      const data = req.body;

      // 1. Insert report
      const result = await lessonsReportsCollection.insertOne(data);

      // 2. Increment reportCount in lessons collection
      const updateResult = await lessonsCollection.updateOne(
        { _id: new ObjectId(data.lessonId) }, // make sure lessonId is ObjectId
        { $inc: { reportsCount: 1 } } // increment by 1
      );

      res
        .status(201)
        .send({ reportResult: result, lessonUpdate: updateResult });
    } catch (err) {
      console.error(err);
      res.status(500).send({ message: "Failed to report" });
    }
  });

  app.get("/lessonsReports", async (req, res) => {
    try {
      // GET all reports
      const reports = await lessonsReportsCollection.find({}).toArray();

      // Map to include count of reasons
      const formattedReports = reports.map((r) => ({
        lessonId: r.lessonId,
        title: r.title,
        reasons: r.reasons || [],
        count: r.reasons ? r.reasons.length : 0,
      }));

      res.status(200).send(formattedReports);
    } catch (err) {
      console.error(err);
      res.status(500).send({ message: "Failed to get reports" });
    }
  });

  // Ignore report for a lesson
  app.patch("/lessonsReports/:lessonId/ignore", async (req, res) => {
    try {
      const { lessonId } = req.params;
      const result = await lessonsReportsCollection.updateOne(
        { lessonId },
        { $set: { reasons: [] } }
      );

      res.status(200).send({ message: "Reports ignored successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).send({ message: "Failed to ignore reports" });
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
