import { getCapTcha, login, register, rotatedRefreshToken, verifyOTP } from "../controllers/auth.controller.js";
import express from 'express';

const router = express.Router();

router.route("/auth/captcha").get(getCapTcha);
router.route("/auth/send-otp").post(register);
router.route("/auth/verify-otp").post(verifyOTP);
router.route("/auth/login").post(login);
router.route("/auth/refresh").post(rotatedRefreshToken);

export default router;