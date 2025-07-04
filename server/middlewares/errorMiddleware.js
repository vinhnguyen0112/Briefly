const { ERROR_CODES } = require("../errors");
const AppError = require("../models/appError");

const globalErrorHandler = (err, req, res, next) => {
  console.error("Error caught in global handler: ", err);

  // if already handled as AppError
  if (err instanceof AppError) {
    return res.status(err.status).json({
      success: false,
      error: {
        code: err.code || 400,
        message: err.message,
      },
    });
  }

  // handle MySQL known errors
  if (err.code) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        success: false,
        error: {
          code: ERROR_CODES.DUPLICATE_ENTRY,
          message: "A record with the same value already exists.",
        },
      });
    } else if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({
        success: false,
        error: {
          code: ERROR_CODES.REFERENCED_ROW_MISSING,
          message: "Referenced resource does not exist.",
        },
      });
    } else if (err.code === "ER_BAD_NULL_ERROR") {
      return res.status(400).json({
        success: false,
        error: {
          code: ERROR_CODES.NULL_FIELD,
          message: "A required field is missing.",
        },
      });
    } else if (err.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(400).json({
        success: false,
        error: {
          code: ERROR_CODES.ROW_IS_REFERENCED,
          message:
            "Cannot delete or update this resource because it is still referenced elsewhere.",
        },
      });
    } else if (err.code === "ER_WARN_DATA_OUT_OF_RANGE") {
      return res.status(400).json({
        success: false,
        error: {
          code: ERROR_CODES.OUT_OF_RANGE,
          message: "Data out of range.",
        },
      });
    } else if (err.code === "ER_DATA_TOO_LONG") {
      return res.status(400).json({
        success: false,
        error: {
          code: ERROR_CODES.TOO_LONG,
          message: "Data too long.",
        },
      });
    }
  }

  // fallback for unknown errors
  return res.status(500).json({
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message:
        process.env.NODE_ENV === "production" ? "Server error" : err.message,
    },
  });
};

module.exports = { globalErrorHandler };
