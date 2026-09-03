import * as dashboardService from "../services/dashboard.service.js";

export const getStats = async (req, res, next) => {
  try {
    const stats = await dashboardService.getDashboardStats(req.user._id);
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

export const getSchedule = async (req, res, next) => {
  try {
    const { date } = req.query;
    const schedule = await dashboardService.getDailySchedule(req.user._id, date);
    res.status(200).json({ success: true, data: schedule });
  } catch (error) {
    next(error);
  }
};

export const createScheduleEvent = async (req, res, next) => {
  try {
    const event = await dashboardService.createScheduleEvent(req.user._id, req.body);
    res.status(201).json({
      success: true,
      message: "Event added to schedule",
      data: event,
    });
  } catch (error) {
    next(error);
  }
};

export const updateScheduleEvent = async (req, res, next) => {
  try {
    const event = await dashboardService.updateScheduleEvent(
      req.user._id,
      req.params.id,
      req.body
    );
    res.status(200).json({
      success: true,
      message: "Event updated successfully",
      data: event,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteScheduleEvent = async (req, res, next) => {
  try {
    await dashboardService.deleteScheduleEvent(req.user._id, req.params.id);
    res.status(200).json({
      success: true,
      message: "Event removed from schedule",
    });
  } catch (error) {
    next(error);
  }
};

export const getAttendance = async (req, res, next) => {
  try {
    const attendance = await dashboardService.getAttendanceOverview(req.user._id);
    res.status(200).json({ success: true, data: attendance });
  } catch (error) {
    next(error);
  }
};

export const createCourse = async (req, res, next) => {
  try {
    const course = await dashboardService.createAttendanceCourse(req.user._id, req.body);
    res.status(201).json({
      success: true,
      message: "Course created successfully",
      data: course,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCourse = async (req, res, next) => {
  try {
    await dashboardService.deleteAttendanceCourse(req.user._id, req.params.id);
    res.status(200).json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const logAttendance = async (req, res, next) => {
  try {
    const updatedCourse = await dashboardService.logAttendanceRecord(req.user._id, req.body);
    res.status(200).json({
      success: true,
      message: "Attendance recorded successfully",
      data: updatedCourse,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAttendanceRecord = async (req, res, next) => {
  try {
    const { courseId, date } = req.params;
    const updatedCourse = await dashboardService.deleteAttendanceRecord(
      req.user._id,
      courseId,
      date
    );
    res.status(200).json({
      success: true,
      message: "Attendance record removed",
      data: updatedCourse,
    });
  } catch (error) {
    next(error);
  }
};
