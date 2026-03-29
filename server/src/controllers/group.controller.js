import Group from "../models/Group.js";
import Zone from "../models/Zone.js";
import Counter from "../models/Counter.js";

export const getGroups = async (req, res) => {
  try {
    const { zoneId } = req.query;
    const query = zoneId ? { zone: zoneId } : {};
    
    const groups = await Group.find(query)
      .populate('zone')
      .populate({
        path: 'counters',
        populate: {
          path: 'services'
        }
      });
    
    res.json({ success: true, groups });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ message: 'Failed to get groups' });
  }
};

export const getGroupById = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('zone')
      .populate({
        path: 'counters',
        populate: {
          path: 'services'
        }
      });
    
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    res.json({ success: true, group });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ message: 'Failed to get group' });
  }
};

export const createGroup = async (req, res) => {
  try {
    const { name, code, zoneId, description } = req.body;
    
    // Check if zone exists
    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).json({ message: 'Zone not found' });
    }
    
    // Check if group code is unique
    const existingGroup = await Group.findOne({ code: code.toUpperCase() });
    if (existingGroup) {
      return res.status(400).json({ message: 'Group code already exists' });
    }
    
    const group = new Group({
      name,
      code: code.toUpperCase(),
      zone: zoneId,
      description
    });
    
    await group.save();
    
    // Add group to zone
    zone.groups.push(group._id);
    await zone.save();
    
    const populatedGroup = await Group.findById(group._id)
      .populate('zone')
      .populate('counters');
    
    res.status(201).json({ success: true, group: populatedGroup });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ message: 'Failed to create group' });
  }
};

export const updateGroup = async (req, res) => {
  try {
    const { name, code, zoneId, description, isActive } = req.body;
    
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    // Handle zone change
    if (zoneId && zoneId !== group.zone.toString()) {
      const newZone = await Zone.findById(zoneId);
      if (!newZone) {
        return res.status(404).json({ message: 'New zone not found' });
      }
      
      // Remove from old zone
      const oldZone = await Zone.findById(group.zone);
      if (oldZone) {
        oldZone.groups = oldZone.groups.filter(g => g.toString() !== group._id.toString());
        await oldZone.save();
      }
      
      // Add to new zone
      newZone.groups.push(group._id);
      await newZone.save();
      
      group.zone = zoneId;
    }
    
    if (name) group.name = name;
    if (code) group.code = code.toUpperCase();
    if (description !== undefined) group.description = description;
    if (isActive !== undefined) group.isActive = isActive;
    
    await group.save();
    
    const updatedGroup = await Group.findById(group._id)
      .populate('zone')
      .populate('counters');
    
    res.json({ success: true, group: updatedGroup });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ message: 'Failed to update group' });
  }
};

export const deleteGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    // Check if group has counters
    const countersCount = await Counter.countDocuments({ group: group._id });
    if (countersCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete group with existing counters. Remove all counters first.' 
      });
    }
    
    // Remove group from zone
    const zone = await Zone.findById(group.zone);
    if (zone) {
      zone.groups = zone.groups.filter(g => g.toString() !== group._id.toString());
      await zone.save();
    }
    
    await group.deleteOne();
    
    res.json({ success: true, message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ message: 'Failed to delete group' });
  }
};