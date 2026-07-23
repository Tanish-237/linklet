import { jest } from '@jest/globals';
import { AppError } from "../src/utils/error.js";

const mockFind = jest.fn();
const mockFindOne = jest.fn();
const mockCreate = jest.fn();
const mockFindOneAndDelete = jest.fn();
const mockFindByIdAndUpdate = jest.fn();
const mockResourceFindById = jest.fn();

jest.unstable_mockModule("../models/collection.js", () => ({
  Collection: {
    find: mockFind,
    findOne: mockFindOne,
    create: mockCreate,
    findOneAndDelete: mockFindOneAndDelete,
    findByIdAndUpdate: mockFindByIdAndUpdate,
  },
}));

jest.unstable_mockModule("../models/resource.js", () => ({
  Resource: {
    findById: mockResourceFindById,
  },
}));

const collectionController = await import("../src/controllers/collection.controller.js");

const mockReq = (overrides = {}) => ({
  user: { _id: "user123" },
  body: {},
  params: {},
  ...overrides,
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

describe("Collection Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createCollection", () => {
    it("throws AppError if name is missing", async () => {
      const req = mockReq({ body: { coverColor: "#fff" } });
      const res = mockRes();
      await collectionController.createCollection(req, res, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
    });

    it("creates a collection successfully", async () => {
      const req = mockReq({ body: { name: "My Board" } });
      const res = mockRes();
      mockCreate.mockResolvedValue({ _id: "col1", name: "My Board" });

      await collectionController.createCollection(req, res, mockNext);

      expect(mockCreate).toHaveBeenCalledWith({
        name: "My Board",
        userId: "user123",
        coverColor: "#8b5cf6",
        resources: [],
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { _id: "col1", name: "My Board" },
      });
    });
  });

  describe("deleteCollection", () => {
    it("deletes a collection successfully", async () => {
      const req = mockReq({ params: { id: "col1" } });
      const res = mockRes();
      mockFindOneAndDelete.mockResolvedValue({ _id: "col1" });

      await collectionController.deleteCollection(req, res, mockNext);
      expect(mockFindOneAndDelete).toHaveBeenCalledWith({ _id: "col1", userId: "user123" });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});
