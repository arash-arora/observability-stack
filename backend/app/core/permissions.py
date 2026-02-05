from enum import Enum


class Permissions(str, Enum):
    # Organization Permissions
    ORG_READ = "org:read"
    ORG_UPDATE = "org:update"
    ORG_DELETE = "org:delete"

    # Project Permissions
    PROJECT_CREATE = "project:create"
    PROJECT_READ = "project:read"
    PROJECT_UPDATE = "project:update"
    PROJECT_DELETE = "project:delete"

    # Application Permissions
    APP_CREATE = "app:create"
    APP_READ = "app:read"
    APP_UPDATE = "app:update"
    APP_DELETE = "app:delete"

    # Evaluation Permissions
    EVAL_RUN = "eval:run"
    EVAL_READ = "eval:read"
    EVAL_CREATE = "eval:create"

    # User Management (Platform Admin mostly, but could be Organization Admin)
    USER_MANAGE = "user:manage"


# Default Role Permissions
DEFAULT_PERMISSIONS = {
    "admin": [
        Permissions.ORG_READ,
        Permissions.ORG_UPDATE,
        Permissions.ORG_DELETE,
        Permissions.PROJECT_CREATE,
        Permissions.PROJECT_READ,
        Permissions.PROJECT_UPDATE,
        Permissions.PROJECT_DELETE,
        Permissions.APP_CREATE,
        Permissions.APP_READ,
        Permissions.APP_UPDATE,
        Permissions.APP_DELETE,
        Permissions.EVAL_RUN,
        Permissions.EVAL_READ,
        Permissions.EVAL_CREATE,
        Permissions.USER_MANAGE,
    ],
    "maintainer": [
        Permissions.ORG_READ,
        Permissions.PROJECT_READ,
        Permissions.APP_CREATE,
        Permissions.APP_READ,
        Permissions.APP_UPDATE,
        Permissions.EVAL_RUN,
        Permissions.EVAL_READ,
        Permissions.EVAL_CREATE,
    ],
    "developer": [
        Permissions.ORG_READ,
        Permissions.PROJECT_READ,
        Permissions.APP_READ,
        Permissions.EVAL_RUN,
        Permissions.EVAL_READ,
    ],
}
