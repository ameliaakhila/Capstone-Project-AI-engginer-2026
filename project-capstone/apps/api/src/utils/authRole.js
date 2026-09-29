// src/utils/authRole.js

export const getCurrentUser = () => {
  try {
    const user =
      localStorage.getItem("user") ||
      localStorage.getItem("currentUser") ||
      localStorage.getItem("authUser");

    if (!user) return null;

    return JSON.parse(user);
  } catch (error) {
    return null;
  }
};

export const isAdminUser = () => {
  const user = getCurrentUser();

  return user?.isAdmin === true || Number(user?.roleId) === 1;
};