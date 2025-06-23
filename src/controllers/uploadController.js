const {
  initiateMultipartUpload,
  createPresignedUrl,
  uploadPart,
  completeMultipartUpload,
  generateDownloadUrl
} = require('../middlewares/aws-v3');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const {
  initiateUploadSchema,
  generatePresignedUrlSchema,
  completeUploadSchema
} = require('../utils/joi/fileUploadValidations');

const initiateUpload = catchAsync(async (req, res, next) => {
  const { error } = initiateUploadSchema.validate(req.body, {
    abortEarly: false
  });

  if (error) {
    const errorFields = error.details.reduce((acc, err) => {
      acc[err.context.key] = err.message.replace(/['"]/g, '');
      return acc;
    }, {});

    return next(new AppError('Validation failed', 400, { errorFields }));
  }
  const { fileName, filetype } = req.body;
  console.log('files coming', req.body);

  const response = await initiateMultipartUpload(fileName, filetype);
  return res.status(200).json({ success: true, response });
});

const generatePresignedUrl = catchAsync(async (req, res, next) => {
  const { error } = generatePresignedUrlSchema.validate(req.body, {
    abortEarly: false
  });

  if (error) {
    const errorFields = error.details.reduce((acc, err) => {
      acc[err.context.key] = err.message.replace(/['"]/g, '');
      return acc;
    }, {});

    return next(new AppError('Validation failed', 400, { errorFields }));
  }
  const { fileName, uploadId, filetype, numChunks } = req.body;

  console.log('pre signed body', req.body);

  const urls = await Promise.all(
    Array.from({ length: numChunks }, (_, i) =>
      createPresignedUrl(fileName, uploadId, i + 1, filetype)
    )
  );

  return res.status(200).json({ success: true, urls });
});

const completeUpload = catchAsync(async (req, res, next) => {
  const { error } = completeUploadSchema.validate(req.body, {
    abortEarly: false
  });

  if (error) {
    const errorFields = error.details.reduce((acc, err) => {
      acc[err.context.key] = err.message.replace(/['"]/g, '');
      return acc;
    }, {});

    return next(new AppError('Validation failed', 400, { errorFields }));
  }

  const { fileName, uploadId } = req.body;

  const response = await completeMultipartUpload(fileName, uploadId);
  return res.status(200).json({
    success: true,
    message: 'Upload completed successfully',
    data: response
  });
});

const uploadChunk = catchAsync(async (req, res, next) => {
  const { index, fileName, filetype } = req.body;
  const { uploadId } = req.query;
  const { file } = req;
  if (!index || !fileName || !uploadId || !file) {
    return next(new AppError('Missing required parameters.', 400));
  }

  const response = await uploadPart(index, fileName, file.buffer, uploadId, filetype);
  return res.status(200).json({
    success: true,
    message: 'Chunk uploaded successfully',
    data: response
  });
});

const downloadAwsObject = catchAsync(async (req, res, next) => {
  const { key } = req.body;

  if (!key) {
    return next(new AppError('File key is required.', 400));
  }

  const url = await generateDownloadUrl(key);
  return res.status(200).json({ success: true, url });
});

module.exports = {
  generatePresignedUrl,
  initiateUpload,
  completeUpload,
  uploadChunk,
  downloadAwsObject
};
