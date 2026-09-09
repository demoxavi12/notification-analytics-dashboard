/**
 * Standardized API response format helpers
 */

const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const errorResponse = (
  res,
  message = 'Internal Server Error',
  statusCode = 500,
  errorCode = 'INTERNAL_ERROR',
  details = null
) => {
  const response = {
    success: false,
    error: {
      message,
      code: errorCode,
    },
  };

  if (details) {
    response.error.details = details;
  }

  return res.status(statusCode).json(response);
};

const paginatedResponse = (
  res,
  items = [],
  pagination = { total: 0, page: 1, limit: 10, totalPages: 0 },
  message = 'Success',
  statusCode = 200
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data: items,
    pagination: {
      total: pagination.total,
      page: Number(pagination.page),
      limit: Number(pagination.limit),
      totalPages: Math.ceil(pagination.total / pagination.limit) || 1,
      hasNextPage: Number(pagination.page) < Math.ceil(pagination.total / pagination.limit),
      hasPrevPage: Number(pagination.page) > 1,
    },
  });
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
};
