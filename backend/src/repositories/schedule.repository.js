import mongoose from "mongoose";
import { Schedule } from "../models/schedule.model.js";

export const findByUserIdAndDate = async (userId, date) => {
  return await Schedule.find({ userId, date }).sort({ startTime: 1, deadline: 1 });
};

export const findEventById = async (id, userId) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return await Schedule.findOne({ _id: id, userId });
};

export const createEvent = async (eventData) => {
  const event = new Schedule(eventData);
  return await event.save();
};

export const updateEvent = async (id, userId, updateData) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return await Schedule.findOneAndUpdate(
    { _id: id, userId },
    { $set: updateData },
    { new: true, runValidators: true }
  );
};

export const deleteEvent = async (id, userId) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return await Schedule.findOneAndDelete({ _id: id, userId });
};

export const countPendingTasks = async (userId, date) => {
  return await Schedule.countDocuments({
    userId,
    date,
    type: "task",
    status: { $in: ["pending", "in-progress"] },
  });
};

export const bulkCreateEvents = async (events) => {
  return await Schedule.insertMany(events);
};
