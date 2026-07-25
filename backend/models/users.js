import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: function(v) {
          return v.endsWith('@mnnit.ac.in');
        },
        message: props => 'Only @mnnit.ac.in email addresses are allowed'
      }
    },
    fullName: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default: function () {
        const rawSeed = this.username || Math.random().toString(36).slice(2);
        const seed = encodeURIComponent(rawSeed);
        return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;
      },
    },
    bio: {
      type: String,
      maxlength: 160,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    year: { type: String }, // e.g., "First", "Second"
    department: { type: String },
    skills: [{ type: String }], // e.g., ["Python", "React"]
    userType: { type: String, enum: ["Student", "Alumni"], default: "Student" },
    role: { type: String, enum: ["user", "moderator", "admin"], default: "user" },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Resource" }],
    refreshToken: {
      type: String,
    },
  },
  { timestamps: true }
);

//here we are hashing the password before saving it to the database

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    // Hash only if the password is modified
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

//we use methods to create a method for the schema
//here it  checks if given password matches with pass in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  const isMatch = await bcrypt.compare(enteredPassword, this.password);
  return isMatch;
};

// Create JWT Token
//const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '1h' });

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      id: this._id, //this is payload or we say data
      username: this.username,
      email: this.email,
      fullName: this.fullName,
    },
    process.env.ACCESS_TOKEN_SECRET, //this is secret key
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY, //this is expiry time
    }
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      id: this._id, //this is payload or we say data
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

export const User = mongoose.model("User", userSchema);
