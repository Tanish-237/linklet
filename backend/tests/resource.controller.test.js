import { jest } from '@jest/globals';

const mockUploadResource = jest.fn();
const mockUploadOnCloudinary = jest.fn();

jest.unstable_mockModule('../src/services/resource.service.js', () => ({
  uploadResource: mockUploadResource,
}));
jest.unstable_mockModule('../src/utils/cloudinary.js', () => ({
  uploadOnCloudinary: mockUploadOnCloudinary,
}));

const { createResource } = await import('../src/controllers/resource.controller.js');

const run = async (req) => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  await createResource({ user: { _id: 'u1' }, ...req }, res, next);
  return { res, next };
};

describe('createResource file size', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUploadResource.mockImplementation(async (userId, data) => ({ _id: 'r1', ...data }));
  });

  const upload = {
    body: { title: 'Notes', description: 'd', category: 'notes', department: 'Civil Engineering', semester: '3' },
    file: { path: '/tmp/x.pdf', originalname: 'x.pdf', mimetype: 'application/pdf', size: 999 },
  };

  it("stores Cloudinary's reported size in bytes", async () => {
    mockUploadOnCloudinary.mockResolvedValue({ secure_url: 'https://c/x.pdf', format: 'pdf', public_id: 'x', bytes: 123456 });
    const { next } = await run(upload);
    expect(next).not.toHaveBeenCalled();
    expect(mockUploadResource.mock.calls[0][1]).toMatchObject({ fileSize: 123456 });
  });

  it("falls back to the uploaded file's size, and stores none for links", async () => {
    mockUploadOnCloudinary.mockResolvedValue({ secure_url: 'https://c/x.pdf', format: 'pdf', public_id: 'x' });
    await run(upload);
    expect(mockUploadResource.mock.calls[0][1]).toMatchObject({ fileSize: 999 });

    await run({ body: { title: 'Site', description: 'd', linkUrl: 'https://example.com', department: 'Civil Engineering', semester: '3' } });
    expect(mockUploadResource.mock.calls[1][1].fileSize).toBeUndefined();
  });
});
