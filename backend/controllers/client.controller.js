import Client from '../models/client.model.js';

export const getAllClients = async (req, res) => {
  try {
    const clients = await Client.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: clients });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createClient = async (req, res) => {
  try {
    const client = await Client.create({ ...req.body, user: req.user.id });
    res.json({ success: true, data: client });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteClient = async (req, res) => {
  try {
    await Client.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};