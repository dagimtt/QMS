import User, { rolePermissions } from "../models/User.js";
import Counter from "../models/Counter.js";
import bcrypt from "bcryptjs";

export const getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('-password -refreshToken')
      .populate('counter');
    
    res.json({ success: true, users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Failed to get users', error: error.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id)
      .select('-password -refreshToken')
      .populate('counter');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Failed to get user' });
  }
};

export const createUser = async (req, res) => {
  try {
    const { username, fullName, email, password, role, counter, permissions } = req.body;
    
    console.log('Creating user:', { email, fullName, role });
    
    // Validate required fields
    if (!fullName || !email || !password) {
      return res.status(400).json({ 
        message: 'Missing required fields: fullName, email, and password are required' 
      });
    }
    
    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ 
        message: 'User already exists with this email' 
      });
    }
    
    // Generate unique username
    let finalUsername = username || email.split('@')[0];
    let usernameExists = await User.findOne({ username: finalUsername });
    let counter_suffix = 1;
    
    while (usernameExists) {
      finalUsername = `${email.split('@')[0]}${counter_suffix}`;
      usernameExists = await User.findOne({ username: finalUsername });
      counter_suffix++;
    }
    
    console.log('Generated unique username:', finalUsername);
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Set permissions based on role or custom permissions
    let userPermissions = permissions;
    if (!userPermissions || userPermissions.length === 0) {
      userPermissions = rolePermissions[role] || [];
    }
    
    // Create user
    const user = new User({
      username: finalUsername,
      fullName,
      email,
      password: hashedPassword,
      role: role || 'Verifier',
      counter: counter || null,
      isActive: true,
      permissions: userPermissions
    });
    
    await user.save();
    
    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.refreshToken;
    
    console.log('User created successfully:', userResponse.email, 'Role:', userResponse.role);
    
    res.status(201).json({ 
      success: true, 
      user: userResponse,
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ 
      message: 'Failed to create user', 
      error: error.message 
    });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, role, counter, isActive, permissions } = req.body;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (fullName) user.fullName = fullName;
    if (role) {
      user.role = role;
      // Update permissions based on new role if not explicitly set
      if (!permissions) {
        user.permissions = rolePermissions[role] || [];
      }
    }
    if (counter !== undefined) user.counter = counter;
    if (isActive !== undefined) user.isActive = isActive;
    if (permissions) user.permissions = permissions;
    
    await user.save();
    
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.refreshToken;
    
    res.json({ success: true, user: userResponse });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
};

export const deactivateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.isActive = false;
    user.refreshToken = null;
    await user.save();
    
    res.json({ success: true, message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ message: 'Failed to deactivate user' });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();
    
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Failed to change password' });
  }
};

export const assignCounterToUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { counterId } = req.body;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (counterId) {
      const counter = await Counter.findById(counterId);
      if (!counter) {
        return res.status(404).json({ message: 'Counter not found' });
      }
      
      // Check if user role matches counter type
      if (user.role !== counter.type && user.role !== 'Admin') {
        return res.status(400).json({ 
          message: `User role (${user.role}) does not match counter type (${counter.type})` 
        });
      }
      
      user.counter = counterId;
      await user.save();
      
      // Also assign user to counter if not already assigned
      if (counter.assignedUser?.toString() !== user._id.toString()) {
        counter.assignedUser = user._id;
        await counter.save();
      }
    } else {
      // Remove counter assignment
      if (user.counter) {
        await Counter.findByIdAndUpdate(user.counter, { $unset: { assignedUser: "" } });
      }
      user.counter = null;
      await user.save();
    }
    
    const updatedUser = await User.findById(id)
      .select('-password -refreshToken')
      .populate('counter');
    
    res.json({ 
      success: true, 
      user: updatedUser,
      message: counterId ? 'User assigned to counter successfully' : 'User removed from counter successfully'
    });
  } catch (error) {
    console.error('Assign counter to user error:', error);
    res.status(500).json({ message: 'Failed to assign counter to user' });
  }
};

export const getUnassignedUsers = async (req, res) => {
  try {
    const users = await User.find({ 
      counter: { $in: [null, undefined] },
      isActive: true 
    }).select('-password -refreshToken');
    
    res.json({ success: true, users });
  } catch (error) {
    console.error('Get unassigned users error:', error);
    res.status(500).json({ message: 'Failed to get unassigned users' });
  }
};

// Get role permissions mapping
export const getRolePermissions = async (req, res) => {
  try {
    res.json({
      success: true,
      permissions: rolePermissions
    });
  } catch (error) {
    console.error('Get role permissions error:', error);
    res.status(500).json({ message: 'Failed to get role permissions' });
  }
};

// Update user permissions
export const updateUserPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.permissions = permissions;
    await user.save();
    
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.refreshToken;
    
    res.json({ 
      success: true, 
      user: userResponse,
      message: 'User permissions updated successfully'
    });
  } catch (error) {
    console.error('Update user permissions error:', error);
    res.status(500).json({ message: 'Failed to update user permissions' });
  }
};

// Get users by role
export const getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    
    const users = await User.find({ role, isActive: true })
      .select('-password -refreshToken')
      .populate('counter');
    
    res.json({ success: true, users });
  } catch (error) {
    console.error('Get users by role error:', error);
    res.status(500).json({ message: 'Failed to get users by role' });
  }
};