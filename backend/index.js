const express = require("express");
const mongoose = require("mongoose");
const app = express();
const { Schema } = mongoose;
app.use(express.json());
const cookieParser = require("cookie-parser");
const cors = require('cors')
app.use(cookieParser());
const jwt = require('jsonwebtoken');




app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // Change '*' to your application's origin if needed
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});
const connection = async () => {
  try {
    mongoose.connect(
      "mongodb+srv://pratyush83:pratyush83@cluster0.bzf29ny.mongodb.net/upi"
    );
    console.log("DB connected");
  } catch (e) {
    console.log("error", e);
  }
};

//make models controllers and routes
//1. Register User
const userSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
});

const User = mongoose.model("User", userSchema);


 const register = async (req, res) => {
  try {
    const newUser = new User(req.body);
    await newUser.save();
    res.status(200).send("resgister successfully");
  } catch (error) {
    return res.status(500).send("error from controller register");
  }
};

 const login = async (req, res) => {
  try {
    const user = await User.findOne({ name: req.body.name });
    console.log(req.body.user);
    if (!user) {
      return res.status(500).send("user not found from login controller");
    }
    if (user.password !== req.body.password) {
      return res.status(500).send("passowrd not found login controller");
    }
    const token = jwt.sign({ id: user._id }, "jwt");

    res.cookie("accesstoken", token, { httpOnly: true }).status(200).send(user);
    console.log(token);
  } catch (e) {
    res.status(500).send("error in login");
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
app.post('/register', register);
app.post('/login', login);

//2. Category  Schema
const categorySchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    default: "good",
    required: true,
  },
    user: {
      type: String,
      required : true 
      // ref: 'User',
      // required: true
    }
});
categorySchema.index({ user: 1, name: 1 }, { unique: true });

const Category = mongoose.model("Category", categorySchema);
const createCategory = async (req, res) => {
  try {
    const { name, description, user } = req.body;
    const category = new Category({ name, description, user });
    await category.save();
    console.log(category);
    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log("error", err);
  }
};

const getCategories = async (req, res) => {
  try {
  
    const userId = String(req.params.userId);
    console.log(userId);
    const categories = await Category.find({ user: userId });
    console.log(categories)
    res.status(200).json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
app.post("/postcategories", createCategory);
app.get("/getcategories/:userId",getCategories);





//3. Register a upi transaction
const transactionSchema = new Schema({
  amount: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  description: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    ddefault: "UPI",
    required: true,
  },
  party: {
    type: String,
    required: true,
  },
  lender: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: function () {
      return this.type === "Lent";
    },
  },
  borrower: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: function () {
      return this.type === "Borrowed";
    },
  },
  category: {
    type: String,
    //ref: "Category",
    required: true,
  },
  user: {
    type: String,
    required : true
    // ref: "User",
    // required: true,
  },
});
const Transaction = mongoose.model("Transaction", transactionSchema);

const ensureCategoryExists = async (categoryName,user) => {
  let category = await Category.findOne({ name: categoryName });
  if (!category) {
    category = new Category({
      name: categoryName,
      description: "Auto-generated category",
      user : user
    });
    await category.save();
  }
  return category;
};

// Create a new transaction
const createTransaction = async (req, res) => {
  try {
    const {
      amount,
      description,
      type,
      party,
      lender,
      borrower,
      categoryName,
      user,
    } = req.body;

    // Ensure the category exists or create it
    const category = await ensureCategoryExists(categoryName,user);

    const newTransaction = new Transaction({
      amount,
      description,
      type,
      party,
      lender,
      borrower,
      category: category._id,
      user,
    });

    await newTransaction.save();
    res.status(201).json(newTransaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getTransactionsByUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    const transactions = await Transaction.find({ user: userId })
      .populate('lender')
      .populate('borrower')
      .populate({
        path: 'category',
        model: 'Category',
        match: {
          _id: { $in: await Category.find().distinct('_id') }
        },
        select: 'name' 
      })
      .populate('user');
    res.status(200).json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findByIdAndDelete(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    res.status(200).json({ message: 'Transaction deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

app.post("/maketransactions", createTransaction);
app.get('/transactions/:userId', getTransactionsByUser)
app.delete('/transactions/:id',deleteTransaction);





app.listen("8000", () => {
  connection();
  console.log("server connected");
});
