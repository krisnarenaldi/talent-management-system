# Import semua model agar Alembic dapat mendeteksinya saat autogenerate migrations
from app.models.user import User
from app.models.client import Client
from app.models.position import Position
from app.models.candidate import Candidate, CandidateEducation, CandidateExperience, CandidateDocument
from app.models.application import Application, StageHistory, AIScreeningResult
from app.models.blacklist import Blacklist, BlacklistStatusType
from app.models.employee import Employee, EmployeeContract, AgreementType, EmployeePayroll, EmployeeDocument
from app.models.generated_cv import GeneratedCV
