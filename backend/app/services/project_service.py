from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.project import Project, ProjectMember
from app.models.environment import Environment
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectUpdate, EnvironmentCreate, EnvironmentUpdate


class ProjectService:
    def __init__(self, db: Session):
        self.db = db

    # ===== 项目 CRUD =====

    def get_projects(self, user_id: int) -> list[Project]:
        """获取用户有权限的项目（自己创建的 + 作为成员的）"""
        owned = self.db.query(Project).filter(
            Project.owner_id == user_id,
            Project.is_active == True,
        ).all()

        member_project_ids = [
            m.project_id for m in
            self.db.query(ProjectMember).filter(ProjectMember.user_id == user_id).all()
        ]
        member_projects = self.db.query(Project).filter(
            Project.id.in_(member_project_ids),
            Project.owner_id != user_id,
            Project.is_active == True,
        ).all()

        return owned + member_projects

    def get_project(self, project_id: int, user_id: int) -> Project:
        project = self.db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")
        self._check_access(project_id, user_id)
        return project

    def create_project(self, data: ProjectCreate, user_id: int) -> Project:
        project = Project(
            name=data.name,
            description=data.description,
            owner_id=user_id,
        )
        self.db.add(project)
        self.db.flush()

        # 创建者自动成为 owner 成员
        member = ProjectMember(project_id=project.id, user_id=user_id, role="owner")
        self.db.add(member)
        self.db.commit()
        self.db.refresh(project)
        return project

    def update_project(self, project_id: int, data: ProjectUpdate, user_id: int) -> Project:
        project = self.get_project(project_id, user_id)
        self._check_admin(project_id, user_id)

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(project, field, value)
        self.db.commit()
        self.db.refresh(project)
        return project

    def delete_project(self, project_id: int, user_id: int) -> None:
        project = self.get_project(project_id, user_id)
        if project.owner_id != user_id:
            raise HTTPException(status_code=403, detail="只有项目创建者才能删除项目")
        project.is_active = False
        self.db.commit()

    # ===== 成员管理 =====

    def get_members(self, project_id: int, user_id: int) -> list[dict]:
        self._check_access(project_id, user_id)
        members = self.db.query(ProjectMember).filter(
            ProjectMember.project_id == project_id
        ).all()

        result = []
        for m in members:
            user = self.db.query(User).filter(User.id == m.user_id).first()
            if user:
                result.append({
                    "id": m.id,
                    "project_id": m.project_id,
                    "user_id": m.user_id,
                    "role": m.role,
                    "username": user.username,
                    "full_name": user.full_name,
                    "email": user.email,
                })
        return result

    def add_member(self, project_id: int, username: str, role: str, operator_id: int) -> dict:
        self._check_admin(project_id, operator_id)

        target_user = self.db.query(User).filter(User.username == username).first()
        if not target_user:
            raise HTTPException(status_code=404, detail=f"用户 '{username}' 不存在")

        existing = self.db.query(ProjectMember).filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == target_user.id,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="该用户已是项目成员")

        member = ProjectMember(project_id=project_id, user_id=target_user.id, role=role)
        self.db.add(member)
        self.db.commit()
        self.db.refresh(member)

        return {
            "id": member.id,
            "project_id": member.project_id,
            "user_id": member.user_id,
            "role": member.role,
            "username": target_user.username,
            "full_name": target_user.full_name,
            "email": target_user.email,
        }

    def remove_member(self, project_id: int, user_id_to_remove: int, operator_id: int) -> None:
        project = self.db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")

        if user_id_to_remove == project.owner_id:
            raise HTTPException(status_code=400, detail="不能移除项目创建者")

        self._check_admin(project_id, operator_id)

        member = self.db.query(ProjectMember).filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id_to_remove,
        ).first()
        if not member:
            raise HTTPException(status_code=404, detail="该用户不是项目成员")

        self.db.delete(member)
        self.db.commit()

    # ===== 环境配置 =====

    def get_environments(self, project_id: int, user_id: int) -> list[Environment]:
        self._check_access(project_id, user_id)
        return self.db.query(Environment).filter(
            Environment.project_id == project_id
        ).all()

    def create_environment(self, project_id: int, data: EnvironmentCreate, user_id: int) -> Environment:
        self._check_access(project_id, user_id)
        env = Environment(project_id=project_id, **data.model_dump())
        self.db.add(env)
        self.db.commit()
        self.db.refresh(env)
        return env

    def update_environment(self, env_id: int, data: EnvironmentUpdate, user_id: int) -> Environment:
        env = self.db.query(Environment).filter(Environment.id == env_id).first()
        if not env:
            raise HTTPException(status_code=404, detail="环境不存在")
        self._check_access(env.project_id, user_id)

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(env, field, value)
        self.db.commit()
        self.db.refresh(env)
        return env

    def delete_environment(self, env_id: int, user_id: int) -> None:
        env = self.db.query(Environment).filter(Environment.id == env_id).first()
        if not env:
            raise HTTPException(status_code=404, detail="环境不存在")
        self._check_access(env.project_id, user_id)
        self.db.delete(env)
        self.db.commit()

    # ===== 权限检查辅助方法 =====

    def _check_access(self, project_id: int, user_id: int) -> None:
        """检查用户是否有项目访问权限"""
        project = self.db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")
        if project.owner_id == user_id:
            return
        member = self.db.query(ProjectMember).filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        ).first()
        if not member:
            raise HTTPException(status_code=403, detail="无权访问该项目")

    def _check_admin(self, project_id: int, user_id: int) -> None:
        """检查用户是否有管理权限（owner 或 admin）"""
        project = self.db.query(Project).filter(Project.id == project_id).first()
        if project and project.owner_id == user_id:
            return
        member = self.db.query(ProjectMember).filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        ).first()
        if not member or member.role not in ("owner", "admin"):
            raise HTTPException(status_code=403, detail="需要管理员权限")
