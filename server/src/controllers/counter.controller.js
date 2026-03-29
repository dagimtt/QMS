import Counter from "../models/Counter.js";
import Group from "../models/Group.js";
import Service from "../models/Service.js";
import User from "../models/User.js";

export const getCounters = async (req, res) => {
  try {
    const { groupId, type, isActive } = req.query;
    const query = {};
    
    if (groupId) query.group = groupId;
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    const counters = await Counter.find(query)
      .populate('services')
      .populate('assignedUser', 'fullName email')
      .populate({
        path: 'group',
        populate: {
          path: 'zone'
        }
      });
    
    res.json({ success: true, counters });
  } catch (error) {
    console.error('Get counters error:', error);
    res.status(500).json({ message: 'Failed to get counters' });
  }
};

export const getCounterById = async (req, res) => {
  try {
    const counter = await Counter.findById(req.params.id)
      .populate('services')
      .populate('assignedUser', 'fullName email role')
      .populate({
        path: 'group',
        populate: {
          path: 'zone'
        }
      });
    
    if (!counter) {
      return res.status(404).json({ message: 'Counter not found' });
    }
    
    res.json({ success: true, counter });
  } catch (error) {
    console.error('Get counter error:', error);
    res.status(500).json({ message: 'Failed to get counter' });
  }
};

export const createCounter = async (req, res) => {
  try {
    const { counterNumber, name, type, groupId, services, assignedUserId } = req.body;
    
    // Check if group exists
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    // Check if counter number is unique
    const existingCounter = await Counter.findOne({ counterNumber });
    if (existingCounter) {
      return res.status(400).json({ message: 'Counter number already exists' });
    }
    
    // Validate services exist
    if (services && services.length > 0) {
      const validServices = await Service.find({ _id: { $in: services } });
      if (validServices.length !== services.length) {
        return res.status(400).json({ message: 'One or more services are invalid' });
      }
    }
    
    // Check if assigned user exists and is available
    if (assignedUserId) {
      const user = await User.findById(assignedUserId);
      if (!user) {
        return res.status(404).json({ message: 'Assigned user not found' });
      }
      
      // Check if user already assigned to another active counter
      const existingAssignment = await Counter.findOne({ 
        assignedUser: assignedUserId, 
        isActive: true 
      });
      if (existingAssignment) {
        return res.status(400).json({ 
          message: 'User already assigned to another active counter' 
        });
      }
    }
    
    const counter = new Counter({
      counterNumber,
      name: name || `Counter ${counterNumber}`,
      type,
      group: groupId,
      services: services || [],
      assignedUser: assignedUserId
    });
    
    await counter.save();
    
    // Add counter to group
    group.counters.push(counter._id);
    await group.save();
    
    // Update user's counter assignment
    if (assignedUserId) {
      await User.findByIdAndUpdate(assignedUserId, { counter: counter._id });
    }
    
    const populatedCounter = await Counter.findById(counter._id)
      .populate('services')
      .populate('assignedUser', 'fullName email');
    
    res.status(201).json({ success: true, counter: populatedCounter });
  } catch (error) {
    console.error('Create counter error:', error);
    res.status(500).json({ message: 'Failed to create counter' });
  }
};

export const updateCounter = async (req, res) => {
  try {
    const { name, type, groupId, services, assignedUserId, isActive } = req.body;
    
    const counter = await Counter.findById(req.params.id);
    if (!counter) {
      return res.status(404).json({ message: 'Counter not found' });
    }
    
    // Handle group change
    if (groupId && groupId !== counter.group.toString()) {
      const newGroup = await Group.findById(groupId);
      if (!newGroup) {
        return res.status(404).json({ message: 'New group not found' });
      }
      
      // Remove from old group
      const oldGroup = await Group.findById(counter.group);
      if (oldGroup) {
        oldGroup.counters = oldGroup.counters.filter(c => c.toString() !== counter._id.toString());
        await oldGroup.save();
      }
      
      // Add to new group
      newGroup.counters.push(counter._id);
      await newGroup.save();
      
      counter.group = groupId;
    }
    
    // Handle user assignment change
    if (assignedUserId !== undefined) {
      if (assignedUserId && assignedUserId !== counter.assignedUser?.toString()) {
        const user = await User.findById(assignedUserId);
        if (!user) {
          return res.status(404).json({ message: 'Assigned user not found' });
        }
        
        // Check if user already assigned to another active counter
        const existingAssignment = await Counter.findOne({ 
          assignedUser: assignedUserId, 
          isActive: true,
          _id: { $ne: counter._id }
        });
        if (existingAssignment) {
          return res.status(400).json({ 
            message: 'User already assigned to another active counter' 
          });
        }
        
        // Remove assignment from old user
        if (counter.assignedUser) {
          await User.findByIdAndUpdate(counter.assignedUser, { $unset: { counter: "" } });
        }
        
        // Assign new user
        await User.findByIdAndUpdate(assignedUserId, { counter: counter._id });
        counter.assignedUser = assignedUserId;
      } else if (!assignedUserId && counter.assignedUser) {
        // Remove assignment
        await User.findByIdAndUpdate(counter.assignedUser, { $unset: { counter: "" } });
        counter.assignedUser = null;
      }
    }
    
    // Validate services
    if (services) {
      const validServices = await Service.find({ _id: { $in: services } });
      if (validServices.length !== services.length) {
        return res.status(400).json({ message: 'One or more services are invalid' });
      }
      counter.services = services;
    }
    
    if (name) counter.name = name;
    if (type) counter.type = type;
    if (isActive !== undefined) counter.isActive = isActive;
    
    await counter.save();
    
    const updatedCounter = await Counter.findById(counter._id)
      .populate('services')
      .populate('assignedUser', 'fullName email')
      .populate({
        path: 'group',
        populate: {
          path: 'zone'
        }
      });
    
    res.json({ success: true, counter: updatedCounter });
  } catch (error) {
    console.error('Update counter error:', error);
    res.status(500).json({ message: 'Failed to update counter' });
  }
};

export const deleteCounter = async (req, res) => {
  try {
    const counter = await Counter.findById(req.params.id);
    if (!counter) {
      return res.status(404).json({ message: 'Counter not found' });
    }
    
    // Remove counter from group
    const group = await Group.findById(counter.group);
    if (group) {
      group.counters = group.counters.filter(c => c.toString() !== counter._id.toString());
      await group.save();
    }
    
    // Remove user assignment
    if (counter.assignedUser) {
      await User.findByIdAndUpdate(counter.assignedUser, { $unset: { counter: "" } });
    }
    
    await counter.deleteOne();
    
    res.json({ success: true, message: 'Counter deleted successfully' });
  } catch (error) {
    console.error('Delete counter error:', error);
    res.status(500).json({ message: 'Failed to delete counter' });
  }
};

export const assignServicesToCounter = async (req, res) => {
  try {
    const { counterId } = req.params;
    const { serviceIds } = req.body;
    
    const counter = await Counter.findById(counterId);
    if (!counter) {
      return res.status(404).json({ message: 'Counter not found' });
    }
    
    // Validate services
    const validServices = await Service.find({ _id: { $in: serviceIds } });
    if (validServices.length !== serviceIds.length) {
      return res.status(400).json({ message: 'One or more services are invalid' });
    }
    
    counter.services = serviceIds;
    await counter.save();
    
    const updatedCounter = await Counter.findById(counterId)
      .populate('services')
      .populate('assignedUser', 'fullName email');
    
    res.json({ success: true, counter: updatedCounter });
  } catch (error) {
    console.error('Assign services error:', error);
    res.status(500).json({ message: 'Failed to assign services' });
  }
};

export const getAvailableCounters = async (req, res) => {
  try {
    const { serviceId, type } = req.query;
    const query = { isActive: true };
    
    if (type) query.type = type;
    if (serviceId) query.services = serviceId;
    
    const counters = await Counter.find(query)
      .populate('services')
      .populate('assignedUser', 'fullName email')
      .populate({
        path: 'group',
        populate: {
          path: 'zone'
        }
      });
    
    res.json({ success: true, counters });
  } catch (error) {
    console.error('Get available counters error:', error);
    res.status(500).json({ message: 'Failed to get available counters' });
  }
};