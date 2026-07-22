import express from 'express';
import { getProfile, getUserInternal } from '../controllers/user.controller.js';
import { internalAuth } from '../middlewares/internalAuth.middleware.js';
import { userVerify } from '../middlewares/verify.middlewares.js';

const router = express.Router();

router.route("/user/get-profile").get(userVerify,getProfile);
router.route("/user/user-internal/:userId").get(internalAuth,getUserInternal);

export default router;