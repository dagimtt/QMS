import Counter from "../models/Counter.js";
import Group from "../models/Group.js";
import User from "../models/User.js";

export const getCounters = async (req, res) => {
  try {
    const { groupId, type, isActive, assignedUser } = req.query;
    const query = {};
    
    if (groupId) query.group = groupId;
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (assignedUser) query.assignedUser = assignedUser;
    
    const counters = await Counter.find(query)
      .populate('services')
      .populate('assignedUser', 'fullName email role username')
      .populate('group', 'name code')
      .sort({ counterNumber: 1 });
    
    res.json({ success: true, counters });
  } catch (error) {
    console.error('Get counters error:', error);
    res.status(500).json({ message: 'Failed to get counters' });
  }
};

export const getCounterById = async (req, res) => {
  try {
    const { id } = req.params;
    const counter = await Counter.findById(id)
      .populate('services')
      .populate('assignedUser', 'fullName email role username')
      .populate('group', 'name code');
    
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
    
    console.log('Creating counter:', { counterNumber, type, groupId, assignedUserId });
    
    // Validate required fields
    if (!counterNumber || !type || !groupId) {
      return res.status(400).json({ 
        message: 'Missing required fields: counterNumber, type, and groupId are required' 
      });
    }
    
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
    
    // Check if assigned user exists and is valid
    let assignedUser = null;
    if (assignedUserId) {
      assignedUser = await User.findById(assignedUserId);
      if (!assignedUser) {
        return res.status(404).json({ message: 'Assigned user not found' });
      }
      
      // Check if user is already assigned to another counter
      const existingAssignment = await Counter.findOne({ 
        assignedUser: assignedUserId, 
        isActive: true 
      });
      if (existingAssignment) {
        return res.status(400).json({ 
          message: `User ${assignedUser.fullName} is already assigned to counter ${existingAssignment.counterNumber}` 
        });
      }
      
      // Check if user role matches counter type
      if (assignedUser.role !== type && assignedUser.role !== 'Admin') {
        return res.status(400).json({ 
          message: `User role (${assignedUser.role}) does not match counter type (${type})` 
        });
      }
    }
    
    // Create counter
    const counter = new Counter({
      counterNumber,
      name: name || `Counter ${counterNumber}`,
      type,
      group: groupId,
      services: services || [],
      assignedUser: assignedUserId || null,
      isActive: true,
      status: 'Available'
    });
    
    await counter.save();
    
    // Add counter to group
    group.counters.push(counter._id);
    await group.save();
    
    // Update user's counter assignment if user is assigned
    if (assignedUserId) {
      await User.findByIdAndUpdate(assignedUserId, { counter: counter._id });
    }
    
    // Populate the counter with references
    const populatedCounter = await Counter.findById(counter._id)
      .populate('services')
      .populate('assignedUser', 'fullName email role')
      .populate('group', 'name code');
    
    console.log('Counter created successfully:', counter.counterNumber);
    
    res.status(201).json({ 
      success: true, 
      counter: populatedCounter,
      message: 'Counter created successfully'
    });
  } catch (error) {
    console.error('Create counter error:', error);
    res.status(500).json({ 
      message: 'Failed to create counter', 
      error: error.message 
    });
  }
};

export const updateCounter = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, groupId, services, assignedUserId, isActive, status } = req.body;
    
    const counter = await Counter.findById(id);
    if (!counter) {
      return res.status(404).json({ message: 'Counter not found' });
    }
    
    // Handle user assignment changes
    if (assignedUserId !== undefined) {
      const oldUserId = counter.assignedUser;
      
      if (assignedUserId === null || assignedUserId === '') {
        // Remove user assignment
        if (oldUserId) {
          await User.findByIdAndUpdate(oldUserId, { $unset: { counter: "" } });
        }
        counter.assignedUser = null;
      } else if (assignedUserId !== oldUserId?.toString()) {
        // Assign new user
        const newUser = await User.findById(assignedUserId);
        if (!newUser) {
          return res.status(404).json({ message: 'User not found' });
        }
        
        // Check if user is already assigned to another counter
        const existingAssignment = await Counter.findOne({ 
          assignedUser: assignedUserId, 
          isActive: true,
          _id: { $ne: id }
        });
        if (existingAssignment) {
          return res.status(400).json({ 
            message: `User ${newUser.fullName} is already assigned to counter ${existingAssignment.counterNumber}` 
          });
        }
        
        // Check if user role matches counter type
        const counterType = type || counter.type;
        if (newUser.role !== counterType && newUser.role !== 'Admin') {
          return res.status(400).json({ 
            message: `User role (${newUser.role}) does not match counter type (${counterType})` 
          });
        }
        
        // Remove old assignment if exists
        if (oldUserId) {
          await User.findByIdAndUpdate(oldUserId, { $unset: { counter: "" } });
        }
        
        // Assign new user
        await User.findByIdAndUpdate(assignedUserId, { counter: counter._id });
        counter.assignedUser = assignedUserId;
      }
    }
    
    // Handle group change
    if (groupId && groupId !== counter.group.toString()) {
      const newGroup = await Group.findById(groupId);
      if (!newGroup) {
        return res.status(404).json({ message: 'New group not found' });
      }
      
      const oldGroup = await Group.findById(counter.group);
      if (oldGroup) {
        oldGroup.counters = oldGroup.counters.filter(c => c.toString() !== counter._id.toString());
        await oldGroup.save();
      }
      
      newGroup.counters.push(counter._id);
      await newGroup.save();
      counter.group = groupId;
    }
    
    // Update other fields
    if (name) counter.name = name;
    if (type) counter.type = type;
    if (services) counter.services = services;
    if (isActive !== undefined) counter.isActive = isActive;
    if (status) counter.status = status;
    
    await counter.save();
    
    const updatedCounter = await Counter.findById(counter._id)
      .populate('services')
      .populate('assignedUser', 'fullName email role')
      .populate('group', 'name code');
    
    res.json({ success: true, counter: updatedCounter });
  } catch (error) {
    console.error('Update counter error:', error);
    res.status(500).json({ message: 'Failed to update counter' });
  }
};

export const deleteCounter = async (req, res) => {
  try {
    const { id } = req.params;
    const counter = await Counter.findById(id);
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

export const assignUserToCounter = async (req, res) => {
  try {
    const { counterId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    // Find counter
    const counter = await Counter.findById(counterId);
    if (!counter) {
      return res.status(404).json({ message: 'Counter not found' });
    }
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(400).json({ message: 'User is inactive' });
    }
    
    // Check if user role matches counter type
    if (user.role !== counter.type && user.role !== 'Admin') {
      return res.status(400).json({ 
        message: `User role (${user.role}) does not match counter type (${counter.type})` 
      });
    }
    
    // Check if user is already assigned to another counter
    const existingAssignment = await Counter.findOne({ 
      assignedUser: userId, 
      isActive: true,
      _id: { $ne: counterId }
    });
    
    if (existingAssignment) {
      return res.status(400).json({ 
        message: `User is already assigned to counter ${existingAssignment.counterNumber}` 
      });
    }
    
    // Remove previous user assignment from this counter if exists
    if (counter.assignedUser) {
      await User.findByIdAndUpdate(counter.assignedUser, { $unset: { counter: "" } });
    }
    
    // Assign user to counter
    counter.assignedUser = userId;
    await counter.save();
    
    // Update user's counter reference
    await User.findByIdAndUpdate(userId, { counter: counter._id });
    
    const updatedCounter = await Counter.findById(counterId)
      .populate('assignedUser', 'fullName email role')
      .populate('group', 'name code');
    
    res.json({ 
      success: true, 
      counter: updatedCounter,
      message: `User ${user.fullName} assigned to counter ${counter.counterNumber} successfully`
    });
  } catch (error) {
    console.error('Assign user to counter error:', error);
    res.status(500).json({ message: 'Failed to assign user to counter' });
  }
};

export const removeUserFromCounter = async (req, res) => {
  try {
    const { counterId } = req.params;
    
    const counter = await Counter.findById(counterId);
    if (!counter) {
      return res.status(404).json({ message: 'Counter not found' });
    }
    
    if (!counter.assignedUser) {
      return res.status(400).json({ message: 'No user assigned to this counter' });
    }
    
    const user = await User.findById(counter.assignedUser);
    
    // Remove user assignment
    await User.findByIdAndUpdate(counter.assignedUser, { $unset: { counter: "" } });
    counter.assignedUser = null;
    await counter.save();
    
    res.json({ 
      success: true, 
      counter,
      message: user ? `User ${user.fullName} removed from counter successfully` : 'User removed from counter successfully'
    });
  } catch (error) {
    console.error('Remove user from counter error:', error);
    res.status(500).json({ message: 'Failed to remove user from counter' });
  }
};

export const getCountersByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const counters = await Counter.find({ assignedUser: userId })
      .populate('services')
      .populate('group', 'name code');
    
    res.json({ success: true, counters });
  } catch (error) {
    console.error('Get counters by user error:', error);
    res.status(500).json({ message: 'Failed to get counters' });
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
    const query = { isActive: true, status: 'Available' };
    
    if (type) query.type = type;
    if (serviceId) query.services = serviceId;
    
    const counters = await Counter.find(query)
      .populate('services')
      .populate('assignedUser', 'fullName email')
      .populate('group', 'name code');
    
    res.json({ success: true, counters });
  } catch (error) {
    console.error('Get available counters error:', error);
    res.status(500).json({ message: 'Failed to get available counters' });
  }
};
// Add this to counter.controller.js
export const resetCounterStatus = async (req, res) => {
  try {
    const { counterId } = req.params;
    
    const counter = await Counter.findById(counterId);
    if (!counter) {
      return res.status(404).json({ message: 'Counter not found' });
    }
    
    counter.status = 'Available';
    counter.currentTicket = null;
    await counter.save();
    
    res.json({ 
      success: true, 
      message: `Counter ${counter.counterNumber} reset to available`,
      counter
    });
  } catch (error) {
    console.error('Reset counter error:', error);
    res.status(500).json({ message: 'Failed to reset counter' });
  }
};

export const resetAllCountersInZone = async (req, res) => {
  try {
    const { zoneId } = req.params;
    
    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).json({ message: 'Zone not found' });
    }
    
    const groups = await Group.find({ zone: zoneId });
    const groupIds = groups.map(g => g._id);
    
    const result = await Counter.updateMany(
      { group: { $in: groupIds } },
      { $set: { status: 'Available', currentTicket: null } }
    );
    
    // Reset any stuck tickets
    await Ticket.updateMany(
      { zone: zoneId, status: 'Serving' },
      { $set: { status: 'Waiting', calledAt: null } }
    );
    
    res.json({ 
      success: true, 
      message: `Reset ${result.modifiedCount} counters in ${zone.name}`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Reset zone counters error:', error);
    res.status(500).json({ message: 'Failed to reset counters' });
  }
};