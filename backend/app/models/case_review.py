from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class CaseReview(Base):
    __tablename__ = "case_reviews"

    id         = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title      = Column(String(200), nullable=False)
    status     = Column(String(20), default="active")  # active / completed / expired
    deadline   = Column(Date, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    members = relationship("CaseReviewMember", back_populates="review", cascade="all, delete-orphan")
    items   = relationship("CaseReviewItem",   back_populates="review", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[created_by])


class CaseReviewMember(Base):
    __tablename__ = "case_review_members"

    id        = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("case_reviews.id", ondelete="CASCADE"), nullable=False)
    user_id   = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status    = Column(String(20), default="pending")  # pending / completed

    review = relationship("CaseReview", back_populates="members")
    user   = relationship("User", foreign_keys=[user_id])


class CaseReviewItem(Base):
    __tablename__ = "case_review_items"

    id          = Column(Integer, primary_key=True, index=True)
    review_id   = Column(Integer, ForeignKey("case_reviews.id", ondelete="CASCADE"), nullable=False)
    case_type   = Column(String(20), nullable=False)     # 'api' | 'functional'
    case_id     = Column(Integer, nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    result      = Column(String(20), default="pending")  # pending / approved / rejected / needs_change
    comment     = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    review   = relationship("CaseReview", back_populates="items")
    reviewer = relationship("User", foreign_keys=[reviewer_id])
