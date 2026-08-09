import express from "express";
import { autocompleteAddress } from "../controllers/geocodingController.js";

const router = express.Router();

router.get("/autocomplete", autocompleteAddress);

export default router;
