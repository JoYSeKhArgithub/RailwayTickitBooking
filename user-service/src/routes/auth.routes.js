import { getCapTcha, login, register, rotatedRefreshToken, verifyOTP } from "../controllers/auth.controller.js";
import express from 'express';

const router = express.Router()

router.route("/auth/captcha").get(getCapTcha);
router.route("/auth/signup").post(register);
router.route("/auth/verifyotp").post(verifyOTP);
router.route("/auth/login").post(login);
router.route("/auth/rotatedRefreshToken").post(rotatedRefreshToken)


export default router;