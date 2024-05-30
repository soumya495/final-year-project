/* eslint-disable no-undef */
import jwt from "jsonwebtoken";
import User from "../model/User.js";
import mailSender from "../utils/mailSender.js";
import otpTemplate from "../utils/mailTemplates/otp.js";
import { createOtp, verifyOtp } from "../utils/otp.js";
import * as crypto from "crypto";

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

// @desc   Send Otp to user
// route   POST /api/user/send-otp
// access  Public
export const sendOtp = async (req, res) => {
  console.log("/api/user/sendOtp Body......", req.body);
  const { email, type } = req.body;

  // Check if type is valid
  if (!type || (type !== "signup" && type !== "forgot-password")) {
    return res.status(400).json({
      success: false,
      message: "Invalid type",
    });
  }

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required",
    });
  }

  const { otp, otpToken } = createOtp(email, type);

  // Sending OTP to the user via email
  try {
    const mailResponse = await mailSender(
      email,
      "OTP for Blood Connect",
      otpTemplate(otp, type)
    );
    console.log("Otp Email Sent Succesfully", mailResponse);
  } catch (error) {
    console.log("Could Not Send OTP Email", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }

  // set otptoken in cookie and send response
  res
    .cookie("otpToken", otpToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 5 * 60 * 1000,
    })
    .status(200)
    .json({
      success: true,
      message: "Otp Sent Successfully",
    });
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

// @desc   Sign New User Up
// route   POST /api/user/signup
// access  Public
export const signUp = async (req, res) => {
  console.log("/api/user/signup Body......", req.body);
  const { email, password, accountType, otp } = req.body;

  const otpToken = req.cookies?.otpToken;

  if (!otpToken) {
    return res.status(400).json({
      success: false,
      message: "OTP Token not found",
    });
  }

  if (
    !accountType.trim() ||
    !email.trim() ||
    !password.trim() ||
    !otp.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  if (accountType !== "User" && accountType !== "Hospital") {
    return res.status(400).json({
      success: false,
      message: "Invalid Account Type",
    });
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: "User already exists",
    });
  }

  // Verify OTP
  const otpVerificationResult = verifyOtp(otpToken, email, otp, "signup");
  if (!otpVerificationResult.success) {
    return res.status(400).json(otpVerificationResult);
  }

  // hash the password
  const hashedPassword = crypto
    .createHmac("sha256", process.env.SECRET)
    .update(password)
    .digest("hex");

  // Create new user
  const newUser = new User({
    email,
    accountType,
    password: hashedPassword,
    approvalStatus: "Started"
  });

  // Save user to the database
  try {
    await newUser.save();
  } catch (error) {
    console.log("Error Saving User to Database", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }

  // clear otpToken cookie and send response
  res.clearCookie("otpToken").status(200).json({
    success: true,
    message: "User Signed Up Successfully",
  });
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

// @desc   Log User In
// route   POST /api/user/login
// access  Public
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email.trim() || !password.trim()) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  // Check if user exists
  const existingUser = await User.findOne({ email });
  if (!existingUser) {
    return res.status(400).json({
      success: false,
      message: "User does not exist",
    });
  }

  // Verify password
  const hashedPassword = crypto
    .createHmac("sha256", process.env.SECRET)
    .update(password)
    .digest("hex");

  if (hashedPassword !== existingUser.password) {
    return res.status(400).json({
      success: false,
      message: "Invalid Password",
    });
  }

  // Create JWT
  const token = jwt.sign(
    {
      id: existingUser._id,
      email: existingUser.email,
      accountType: existingUser.accountType,
    },
    process.env.SECRET,
    {
      // set expiry to 1 day
      expiresIn: "1d",
    }
  );

  const response = {
    success: true,
    message: "User Logged In Successfully",
  }

  response['accountType'] = existingUser.accountType
  response['approvalStatus'] = existingUser.approvalStatus

  res
    .cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    })
    .status(200)
    .json(response);
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

// @desc   Log User Out
// route   POST /api/profile/logout
// access  Private
export const logout = async (req, res) => {
  res.clearCookie("token");
  // clear otpToken cookie if exists
  res.clearCookie("otpToken");
  res.status(200).json({
    success: true,
    message: "User Logged Out Successfully",
  });
};

export const createAdmin = async (req, res) => {
  try {

    const email = 'admin@bloodconnect.in'
    const password = 'Admin@123'
    const accountType = 'Admin'

    // hash the password
    const hashedPassword = crypto
      .createHmac("sha256", process.env.SECRET)
      .update(password)
      .digest("hex");

    // Create new user
    const newUser = new User({
      email,
      accountType,
      password: hashedPassword,
      approvalStatus: "Approved"
    });

    // Save user to the database
    await newUser.save();

  } catch (error) {
    console.log("Error Creating Admin", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
}