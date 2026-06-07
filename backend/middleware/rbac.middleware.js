export const ROLES = {
  ADMIN: "admin",
  SALES: "sales",
  OPERATIONS: "operations",
  ACCOUNTANT: "accountant",
};

export const requireRoles = (...allowedRoles) => (req, res, next) => {
  const role = req.user?.role || "";
  if (role === ROLES.ADMIN || allowedRoles.includes(role)) return next();
  return res.status(403).json({
    success: false,
    message: "You do not have permission to perform this action.",
  });
};

export const allowAdmin = function requireAdminRole(req, res, next) {
  return requireRoles(ROLES.ADMIN)(req, res, next);
};
export const allowFinance = requireRoles(ROLES.ADMIN, ROLES.ACCOUNTANT);
export const allowSalesOps = requireRoles(ROLES.ADMIN, ROLES.SALES, ROLES.OPERATIONS);
export const allowSalesFinance = requireRoles(ROLES.ADMIN, ROLES.SALES, ROLES.ACCOUNTANT);
