import { Branch } from "../models/branch.model.js";

export const createBranch = async (branchData) => {
  const branch = new Branch(branchData);
  return await branch.save();
};

export const findAllBranches = async () => {
  return await Branch.find({});
};

export const findBranchById = async (id) => {
  return await Branch.findById(id);
};

export const updateBranch = async (id, updateData) => {
  return await Branch.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
};

export const deleteBranch = async (id) => {
  return await Branch.findByIdAndDelete(id);
};

export const seedDefaultBranches = async (branchList) => {
  const operations = branchList.map((item) => {
    const name = (typeof item === "string" ? item : item.name).toUpperCase().trim();
    const description = typeof item === "object" ? item.description : `Department of ${item}`;
    return {
      updateOne: {
        filter: { name },
        update: {
          $setOnInsert: {
            name,
            description,
            isActive: true,
          },
        },
        upsert: true,
      },
    };
  });
  await Branch.bulkWrite(operations);
  return await Branch.find({}).lean();
};

