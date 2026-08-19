import multer from "multer";

const maxFileSize = 5 * 1024 * 1024;

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpg",
  "image/jpeg",
]);

const fileFilter = (req, file, cb) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    return cb(new Error("Only PDF, PNG, JPG, JPEG files are supported"));
  }

  cb(null, true);
};

export const uploadHospitalRegistrationDocument = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: maxFileSize,
    files: 1,
  },
});
