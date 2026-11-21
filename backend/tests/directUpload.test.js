import { jest } from '@jest/globals';
import express from 'express';
import supertest from 'supertest';

/**
 * Browser-to-Cloudinary uploads: the signing endpoint, verification of the
 * upload result the client reports back, and the middleware that turns a
 * verified result into a multer-shaped req.file / req.files.
 */

process.env.CLOUDINARY_CLOUD_NAME = 'testcloud';
process.env.CLOUDINARY_API_KEY = '1234';
process.env.CLOUDINARY_API_SECRET = 'test-secret';

jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.unstable_mockModule('../src/middlewares/auth.middleware.js', () => ({
  isLoggedIn: (req, res, next) => {
    req.user = { _id: 'user1' };
    next();
  },
}));

const { v2: cloudinary } = await import('cloudinary');
const { verifyDirectUpload, uploadOnCloudinary, createUploadSignature } = await import('../src/utils/cloudinary.js');
const { acceptDirectUploads } = await import('../src/middlewares/directUpload.middleware.js');
const uploadRoutes = (await import('../src/routes/upload.routes.js')).default;

/** What Cloudinary's upload API returns for a successful upload. */
const cloudinaryResult = (overrides = {}) => {
  const public_id = overrides.public_id ?? 'linklet/chat/abc123';
  const version = overrides.version ?? 1732200000;
  const resource_type = overrides.resource_type ?? 'image';
  return {
    public_id,
    version,
    resource_type,
    format: 'png',
    bytes: 2048,
    secure_url: `https://res.cloudinary.com/testcloud/${resource_type}/upload/v${version}/${public_id}.png`,
    signature: cloudinary.utils.api_sign_request({ public_id, version }, 'test-secret', null, 1),
    original_name: 'photo.png',
    mimetype: 'image/png',
    ...overrides,
  };
};

describe('verifyDirectUpload', () => {
  it('accepts a genuine upload result and normalizes it', () => {
    expect(verifyDirectUpload(cloudinaryResult())).toEqual({
      secure_url: 'https://res.cloudinary.com/testcloud/image/upload/v1732200000/linklet/chat/abc123.png',
      public_id: 'linklet/chat/abc123',
      resource_type: 'image',
      format: 'png',
      bytes: 2048,
    });
  });

  it('rejects a forged signature', () => {
    expect(verifyDirectUpload(cloudinaryResult({ signature: 'f'.repeat(40) }))).toBeNull();
  });

  it('rejects a result whose URL points somewhere else', () => {
    const r = cloudinaryResult();
    expect(verifyDirectUpload({ ...r, secure_url: 'https://evil.example/x.png' })).toBeNull();
    expect(
      verifyDirectUpload({ ...r, secure_url: 'https://res.cloudinary.com/othercloud/image/upload/v1732200000/linklet/chat/abc123.png' })
    ).toBeNull();
    // Signed for one asset, URL of a different one.
    expect(
      verifyDirectUpload({ ...r, secure_url: 'https://res.cloudinary.com/testcloud/image/upload/v1732200000/linklet/chat/other.png' })
    ).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(verifyDirectUpload(null)).toBeNull();
    expect(verifyDirectUpload('x')).toBeNull();
    expect(verifyDirectUpload(cloudinaryResult({ resource_type: 'auto' }))).toBeNull();
    expect(verifyDirectUpload({ ...cloudinaryResult(), version: 'abc' })).toBeNull();
  });
});

describe('uploadOnCloudinary with a direct upload', () => {
  it('returns the verified result without uploading again', async () => {
    const spy = jest.spyOn(cloudinary.uploader, 'upload');
    const verified = verifyDirectUpload(cloudinaryResult());
    await expect(uploadOnCloudinary({ cloudinary: verified })).resolves.toBe(verified);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('acceptDirectUploads middleware', () => {
  const appFor = (field, opts) => {
    const app = express();
    app.use(express.json());
    app.post('/', acceptDirectUploads(field, opts), (req, res) =>
      res.json({ file: req.file ?? null, files: req.files ?? null, body: req.body })
    );
    app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ message: err.message }));
    return app;
  };

  it('exposes a single upload as req.file', async () => {
    const res = await supertest(appFor('image')).post('/').send({ caption: 'hi', imageUpload: cloudinaryResult() });
    expect(res.status).toBe(200);
    expect(res.body.file).toMatchObject({
      fieldname: 'image',
      originalname: 'photo.png',
      mimetype: 'image/png',
      size: 2048,
      cloudinary: { public_id: 'linklet/chat/abc123' },
    });
    expect(res.body.body).toEqual({ caption: 'hi' });
  });

  it('accepts JSON strings (multipart text fields) and several files', async () => {
    const a = cloudinaryResult({ public_id: 'linklet/chat/a' });
    const b = cloudinaryResult({ public_id: 'linklet/chat/b' });
    const res = await supertest(appFor('media', { multiple: true }))
      .post('/')
      .send({ mediaUpload: [JSON.stringify(a), JSON.stringify(b)] });
    expect(res.status).toBe(200);
    expect(res.body.files.map((f) => f.cloudinary.public_id)).toEqual(['linklet/chat/a', 'linklet/chat/b']);
  });

  it('rejects an upload that fails verification', async () => {
    const res = await supertest(appFor('image')).post('/').send({ imageUpload: cloudinaryResult({ signature: 'nope' }) });
    expect(res.status).toBe(400);
  });

  it('rejects more than one file for a single-file field', async () => {
    const res = await supertest(appFor('image')).post('/').send({ imageUpload: [cloudinaryResult(), cloudinaryResult()] });
    expect(res.status).toBe(400);
  });

  it('passes through requests without a direct upload', async () => {
    const res = await supertest(appFor('image')).post('/').send({ caption: 'text only' });
    expect(res.status).toBe(200);
    expect(res.body.file).toBeNull();
  });
});

describe('POST /uploads/sign', () => {
  const app = express();
  app.use(express.json());
  app.use('/uploads', uploadRoutes);

  it('signs an upload into the folder for that purpose', async () => {
    const res = await supertest(app).post('/uploads/sign').send({ purpose: 'chat' });
    expect(res.status).toBe(200);
    const { uploadUrl, apiKey, timestamp, folder, signature } = res.body.data;
    expect(uploadUrl).toBe('https://api.cloudinary.com/v1_1/testcloud/auto/upload');
    expect(apiKey).toBe('1234');
    expect(folder).toBe('linklet/chat');
    expect(signature).toBe(cloudinary.utils.api_sign_request({ timestamp, folder }, 'test-secret'));
  });

  it('rejects an unknown purpose', async () => {
    const res = await supertest(app).post('/uploads/sign').send({ purpose: 'anything' });
    expect(res.status).toBe(400);
  });

  it('never exposes the API secret', () => {
    expect(JSON.stringify(createUploadSignature('linklet/posts'))).not.toContain('test-secret');
  });
});
