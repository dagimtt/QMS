import Zone from "../models/Zone.js";
import Group from "../models/Group.js";

export const getZones = async (req, res) => {
  try {
    const zones = await Zone.find()
      .populate({
        path: 'groups',
        populate: {
          path: 'counters',
          populate: {
            path: 'services'
          }
        }
      });
    
    res.json({ success: true, zones });
  } catch (error) {
    console.error('Get zones error:', error);
    res.status(500).json({ message: 'Failed to get zones' });
  }
};

export const getZoneById = async (req, res) => {
  try {
    const zone = await Zone.findById(req.params.id)
      .populate({
        path: 'groups',
        populate: {
          path: 'counters',
          populate: {
            path: 'services'
          }
        }
      });
    
    if (!zone) {
      return res.status(404).json({ message: 'Zone not found' });
    }
    
    res.json({ success: true, zone });
  } catch (error) {
    console.error('Get zone error:', error);
    res.status(500).json({ message: 'Failed to get zone' });
  }
};

export const createZone = async (req, res) => {
  try {
    const { name, code, description, displayScreen } = req.body;
    
    const existingZone = await Zone.findOne({ $or: [{ name }, { code }] });
    if (existingZone) {
      return res.status(400).json({ message: 'Zone name or code already exists' });
    }
    
    const zone = new Zone({
      name,
      code: code.toUpperCase(),
      description,
      displayScreen
    });
    
    await zone.save();
    
    res.status(201).json({ success: true, zone });
  } catch (error) {
    console.error('Create zone error:', error);
    res.status(500).json({ message: 'Failed to create zone' });
  }
};

export const updateZone = async (req, res) => {
  try {
    const { name, code, description, displayScreen, isActive } = req.body;
    
    const zone = await Zone.findById(req.params.id);
    if (!zone) {
      return res.status(404).json({ message: 'Zone not found' });
    }
    
    if (name) zone.name = name;
    if (code) zone.code = code.toUpperCase();
    if (description !== undefined) zone.description = description;
    if (displayScreen !== undefined) zone.displayScreen = displayScreen;
    if (isActive !== undefined) zone.isActive = isActive;
    
    await zone.save();
    
    res.json({ success: true, zone });
  } catch (error) {
    console.error('Update zone error:', error);
    res.status(500).json({ message: 'Failed to update zone' });
  }
};

export const deleteZone = async (req, res) => {
  try {
    const zone = await Zone.findById(req.params.id);
    if (!zone) {
      return res.status(404).json({ message: 'Zone not found' });
    }
    
    // Check if zone has groups
    const groupsCount = await Group.countDocuments({ zone: zone._id });
    if (groupsCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete zone with existing groups. Remove all groups first.' 
      });
    }
    
    await zone.deleteOne();
    
    res.json({ success: true, message: 'Zone deleted successfully' });
  } catch (error) {
    console.error('Delete zone error:', error);
    res.status(500).json({ message: 'Failed to delete zone' });
  }
};

export const getZoneStatistics = async (req, res) => {
  try {
    const zone = await Zone.findById(req.params.id);
    if (!zone) {
      return res.status(404).json({ message: 'Zone not found' });
    }
    
    const groups = await Group.find({ zone: zone._id }).populate('counters');
    
    const totalCounters = groups.reduce((sum, group) => sum + group.counters.length, 0);
    const activeCounters = groups.reduce((sum, group) => 
      sum + group.counters.filter(c => c.isActive).length, 0
    );
    
    res.json({
      success: true,
      statistics: {
        totalGroups: groups.length,
        totalCounters,
        activeCounters,
        groups: groups.map(g => ({
          name: g.name,
          counters: g.counters.length,
          activeCounters: g.counters.filter(c => c.isActive).length
        }))
      }
    });
  } catch (error) {
    console.error('Get zone statistics error:', error);
    res.status(500).json({ message: 'Failed to get zone statistics' });
  }
};