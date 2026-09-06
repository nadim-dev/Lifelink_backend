import User from "../models/userModel.js";
import BloodBank from "../models/BloodbankModel.js";
import Hospital from "../models/HospitalModel.js";
import DeliveryPartner from "../models/deliveryPartnerModel.js";

export const getAdminDashboardStats = async (req, res) => {
  try {
    const [users, bloodBanks, hospitals, deliveryPartners] = await Promise.all([
      User.aggregate([{ $match: { role: "User" } }, { $group: { _id: "$accountStatus", count: { $sum: 1 } } }]),
      BloodBank.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Hospital.aggregate([{ $group: { _id: "$accountStatus", count: { $sum: 1 } } }]),
      DeliveryPartner.aggregate([{ $group: { _id: "$accountStatus", count: { $sum: 1 } } }]),
    ]);

    const count = (result, key) => result.find((item) => item._id === key)?.count || 0;
    const total = (result) => result.reduce((sum, item) => sum + item.count, 0);

    return res.status(200).json({
      stats: {
        users: { total: total(users), active: count(users, "active") },
        bloodBanks: { total: total(bloodBanks), active: count(bloodBanks, "Approved"), pending: count(bloodBanks, "Pending") },
        hospitals: { total: total(hospitals), active: count(hospitals, "approved"), pending: count(hospitals, "pending") },
        deliveryPartners: { total: total(deliveryPartners), active: count(deliveryPartners, "approved"), pending: count(deliveryPartners, "pending") },
      },
    });
  } catch (error) {
    console.error("Admin dashboard stats error:", error);
    return res.status(500).json({ message: "Unable to load admin dashboard stats" });
  }
};

export const getPendingRegistrations = async (req, res) => {
  try {
    const [bloodBanks, hospitals, partners] = await Promise.all([
      BloodBank.find({ status: "Pending" }).select("bloodBankName createdAt").sort({ createdAt: -1 }).limit(5).lean(),
      Hospital.find({ accountStatus: "pending" }).select("name createdAt").sort({ createdAt: -1 }).limit(5).lean(),
      DeliveryPartner.find({ accountStatus: "pending" }).select("fullName createdAt").sort({ createdAt: -1 }).limit(5).lean(),
    ]);
    const pendingRegistrations = [
      ...bloodBanks.map((item) => ({ id: item._id, name: item.bloodBankName, type: "Blood Bank Registration Request", createdAt: item.createdAt })),
      ...hospitals.map((item) => ({ id: item._id, name: item.name, type: "Hospital Registration Request", createdAt: item.createdAt })),
      ...partners.map((item) => ({ id: item._id, name: item.fullName, type: "Delivery Partner Registration Request", createdAt: item.createdAt })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    return res.status(200).json({ pendingRegistrations });
  } catch (error) {
    console.error("Pending registrations error:", error);
    return res.status(500).json({ message: "Unable to load pending registrations" });
  }
};

export const getPlatformGrowth = async (req, res) => {
  try {
    const range = ["7d", "30d", "6m"].includes(req.query.range) ? req.query.range : "7d";
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const periods = range === "7d" ? 7 : range === "30d" ? 30 : 6;
    if (range === "6m") start.setMonth(start.getMonth() - 5); else start.setDate(start.getDate() - (periods - 1));
    const periodLabel = range === "7d" ? "Last 7 Days" : range === "30d" ? "Last 30 Days" : "Last 6 Months";
    const [users, bloodBanks, hospitals, deliveryPartners] = await Promise.all([
      User.countDocuments({ role: "User", createdAt: { $gte: start } }),
      BloodBank.countDocuments({ createdAt: { $gte: start } }),
      Hospital.countDocuments({ createdAt: { $gte: start } }),
      DeliveryPartner.countDocuments({ createdAt: { $gte: start } }),
    ]);
    return res.json({ range, data: [{ date: periodLabel, users, bloodBanks, hospitals, deliveryPartners }] });
  } catch (error) { console.error("Platform growth error:", error); return res.status(500).json({ message: "Unable to load platform growth" }); }
};
