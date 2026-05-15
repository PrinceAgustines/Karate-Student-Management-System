import datetime
import math

from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone

from ..models import (
    Attendance,
    BadgeDefinition,
    ChallengeDefinition,
    GamificationProfile,
    InstructorRating,
    KataRating,
    KumiteRating,
    Match,
    PerformanceSummary,
    ProgressionInsight,
    Session,
    Student,
    StudentBadge,
    StudentChallenge,
    StanceEvaluation,
    BeltProgressionIndicator,
)


class PerformanceAggregationService:
    @staticmethod
    def _build_date_range(period: str, start_date=None, end_date=None):
        today = timezone.now().date()
        if start_date and end_date:
            return start_date, end_date

        if period == 'monthly':
            first_day = today.replace(day=1)
            return first_day, today
        if period == 'quarterly':
            quarter = (today.month - 1) // 3
            first_month = quarter * 3 + 1
            start = today.replace(month=first_month, day=1)
            return start, today
        if period == 'yearly':
            start = today.replace(month=1, day=1)
            return start, today
        return today.replace(year=today.year - 5, month=1, day=1), today

    @staticmethod
    def _safe_average(result):
        return float(result or 0.0)

    @staticmethod
    def aggregate_kata_score(student: Student, start_date=None, end_date=None):
        date_from, date_to = PerformanceAggregationService._build_date_range('monthly', start_date, end_date)
        pose_evals = StanceEvaluation.objects.filter(
            student=student,
            date_evaluated__range=(date_from, date_to),
        )
        pose_avg = pose_evals.aggregate(avg=Avg('score'))['avg']
        pose_avg = float(pose_avg or 0.0)

        instructor_ratings = InstructorRating.objects.filter(
            student=student,
            date_evaluated__range=(date_from, date_to),
        )
        instructor_avg = instructor_ratings.aggregate(avg=Avg('kata_score'))['avg']
        instructor_avg = float(instructor_avg or 0.0)

        combined = 0.0
        if pose_avg or instructor_avg:
            combined = (pose_avg + instructor_avg) / 2.0

        rating = KataRating.objects.create(
            student=student,
            pose_evaluation_avg=pose_avg,
            instructor_kata_score=instructor_avg,
            combined_kata_score=combined,
            date_recorded=timezone.now().date(),
        )
        return rating

    @staticmethod
    def aggregate_kumite_score(student: Student, start_date=None, end_date=None):
        date_from, date_to = PerformanceAggregationService._build_date_range('monthly', start_date, end_date)
        matches_a = Match.objects.filter(student_a=student, match_date__range=(date_from, date_to))
        matches_b = Match.objects.filter(student_b=student, match_date__range=(date_from, date_to))

        matches_a_count = matches_a.count()
        matches_b_count = matches_b.count()
        total_matches = matches_a_count + matches_b_count

        total_score_a = matches_a.aggregate(total=Sum('score_a'))['total'] or 0
        total_score_b = matches_b.aggregate(total=Sum('score_b'))['total'] or 0
        total_score = float(total_score_a + total_score_b)

        match_avg = float(total_score / total_matches) if total_matches else 0.0
        wins = Match.objects.filter(Q(student_a=student) | Q(student_b=student), winner=student, match_date__range=(date_from, date_to)).count()
        losses = total_matches - wins

        instructor_ratings = InstructorRating.objects.filter(
            student=student,
            date_evaluated__range=(date_from, date_to),
        )
        instructor_avg = instructor_ratings.aggregate(avg=Avg('kumite_score'))['avg']
        instructor_avg = float(instructor_avg or 0.0)

        combined = 0.0
        if match_avg or instructor_avg:
            combined = (match_avg + instructor_avg) / 2.0

        rating = KumiteRating.objects.create(
            student=student,
            match_avg_score=match_avg,
            instructor_kumite_score=instructor_avg,
            combined_kumite_score=combined,
            wins=wins,
            losses=losses,
            date_recorded=timezone.now().date(),
        )
        return rating

    @staticmethod
    def _previous_period_range(start_date, end_date):
        duration = end_date - start_date
        return start_date - duration, start_date - datetime.timedelta(days=1)

    @staticmethod
    def generate_performance_summary(student: Student, period: str = 'monthly', start_date=None, end_date=None):
        date_from, date_to = PerformanceAggregationService._build_date_range(period, start_date, end_date)
        prev_start, prev_end = PerformanceAggregationService._previous_period_range(date_from, date_to)

        kata_avg = PerformanceAggregationService._safe_average(
            StanceEvaluation.objects.filter(
                student=student,
                date_evaluated__range=(date_from, date_to),
            ).aggregate(avg=Avg('score'))['avg']
        )
        kumite_avg = PerformanceAggregationService._safe_average(
            InstructorRating.objects.filter(
                student=student,
                date_evaluated__range=(date_from, date_to),
            ).aggregate(avg=Avg('kumite_score'))['avg']
        )
        discipline_avg = PerformanceAggregationService._safe_average(
            InstructorRating.objects.filter(
                student=student,
                date_evaluated__range=(date_from, date_to),
            ).aggregate(avg=Avg('discipline_score'))['avg']
        )

        overall_avg = 0.0
        weights = [value for value in [kata_avg, kumite_avg, discipline_avg] if value is not None]
        if weights:
            overall_avg = sum(weights) / len(weights)

        def pct_change(current, previous):
            if previous == 0:
                return 0.0
            return round(((current - previous) / previous) * 100.0, 2)

        prev_kata = PerformanceAggregationService._safe_average(
            StanceEvaluation.objects.filter(
                student=student,
                date_evaluated__range=(prev_start, prev_end),
            ).aggregate(avg=Avg('score'))['avg']
        )
        prev_kumite = PerformanceAggregationService._safe_average(
            InstructorRating.objects.filter(
                student=student,
                date_evaluated__range=(prev_start, prev_end),
            ).aggregate(avg=Avg('kumite_score'))['avg']
        )
        prev_discipline = PerformanceAggregationService._safe_average(
            InstructorRating.objects.filter(
                student=student,
                date_evaluated__range=(prev_start, prev_end),
            ).aggregate(avg=Avg('discipline_score'))['avg']
        )
        prev_overall = 0.0
        prev_weights = [value for value in [prev_kata, prev_kumite, prev_discipline] if value is not None]
        if prev_weights:
            prev_overall = sum(prev_weights) / len(prev_weights)

        sessions_attended = Attendance.objects.filter(
            student=student,
            date__range=(date_from, date_to),
        ).count()
        evaluations_count = StanceEvaluation.objects.filter(student=student, date_evaluated__range=(date_from, date_to)).count() + InstructorRating.objects.filter(student=student, date_evaluated__range=(date_from, date_to)).count()
        matches_participated = Match.objects.filter(
            Q(student_a=student) | Q(student_b=student),
            match_date__range=(date_from, date_to),
        ).count()

        metrics = {
            'kata': kata_avg,
            'kumite': kumite_avg,
            'discipline': discipline_avg,
        }
        strength_area = max(metrics, key=metrics.get) if metrics else ''
        improvement_area = min(metrics, key=metrics.get) if metrics else ''

        summary = PerformanceSummary.objects.create(
            student=student,
            period=period,
            start_date=date_from,
            end_date=date_to,
            kata_average=kata_avg,
            kumite_average=kumite_avg,
            discipline_average=discipline_avg,
            overall_average=overall_avg,
            kata_trend=pct_change(kata_avg, prev_kata),
            kumite_trend=pct_change(kumite_avg, prev_kumite),
            discipline_trend=pct_change(discipline_avg, prev_discipline),
            overall_trend=pct_change(overall_avg, prev_overall),
            sessions_attended=sessions_attended,
            evaluations_count=evaluations_count,
            matches_participated=matches_participated,
            strength_area=strength_area,
            improvement_area=improvement_area,
        )
        return summary

    @staticmethod
    def calculate_attendance_percentage(student: Student, start_date, end_date):
        total_sessions = Session.objects.filter(date__range=(start_date, end_date)).count()
        attended_sessions = Attendance.objects.filter(student=student, date__range=(start_date, end_date)).count()
        if total_sessions == 0:
            return 0.0
        return float(min(100.0, (attended_sessions / total_sessions) * 100.0))

    @staticmethod
    def generate_student_progression(student: Student, period: str = 'monthly', start_date=None, end_date=None):
        date_from, date_to = PerformanceAggregationService._build_date_range(period, start_date, end_date)
        kata_rating = PerformanceAggregationService.aggregate_kata_score(student, date_from, date_to)
        kumite_rating = PerformanceAggregationService.aggregate_kumite_score(student, date_from, date_to)
        performance_summary = PerformanceAggregationService.generate_performance_summary(student, period, date_from, date_to)
        attendance_percentage = PerformanceAggregationService.calculate_attendance_percentage(student, date_from, date_to)
        belt_indicator = BeltProgressionService.create_or_update_indicator(
            student,
            performance_summary.kata_average,
            performance_summary.kumite_average,
            performance_summary.discipline_average,
            attendance_percentage,
        )
        insights = ProgressionInsightService.analyze_student_performance(student)
        return {
            'kata_rating': kata_rating,
            'kumite_rating': kumite_rating,
            'performance_summary': performance_summary,
            'belt_progression_indicator': belt_indicator,
            'progression_insights': insights,
        }


class BeltProgressionService:
    BELT_ORDER = [
        'White',
        'Yellow',
        'Orange',
        'Green',
        'Blue',
        'Purple',
        'Brown',
        'Red',
        'Black',
    ]

    DEFAULT_REQUIREMENTS = {
        'kata': 75.0,
        'kumite': 70.0,
        'discipline': 80.0,
        'attendance': 85.0,
    }

    @staticmethod
    def get_next_belt(current_belt: str):
        if not current_belt:
            return 'Yellow'
        try:
            index = BeltProgressionService.BELT_ORDER.index(current_belt)
            return BeltProgressionService.BELT_ORDER[min(index + 1, len(BeltProgressionService.BELT_ORDER) - 1)]
        except ValueError:
            return 'Yellow'

    @staticmethod
    def calculate_readiness(student: Student, kata_average: float, kumite_average: float, discipline_average: float, attendance_percentage: float):
        kata_readiness = min(100.0, (kata_average / BeltProgressionService.DEFAULT_REQUIREMENTS['kata']) * 100.0)
        kumite_readiness = min(100.0, (kumite_average / BeltProgressionService.DEFAULT_REQUIREMENTS['kumite']) * 100.0)
        discipline_readiness = min(100.0, (discipline_average / BeltProgressionService.DEFAULT_REQUIREMENTS['discipline']) * 100.0)
        attendance_readiness = min(100.0, (attendance_percentage / BeltProgressionService.DEFAULT_REQUIREMENTS['attendance']) * 100.0)

        scores = [kata_readiness, kumite_readiness, discipline_readiness, attendance_readiness]
        overall_readiness = sum(scores) / len(scores) if scores else 0.0

        if overall_readiness >= 95.0:
            status = 'ready'
        elif overall_readiness >= 70.0:
            status = 'in_progress'
        else:
            status = 'not_ready'

        return {
            'kata_readiness': round(kata_readiness, 2),
            'kumite_readiness': round(kumite_readiness, 2),
            'discipline_readiness': round(discipline_readiness, 2),
            'attendance_readiness': round(attendance_readiness, 2),
            'overall_readiness_percentage': round(overall_readiness, 2),
            'readiness_status': status,
        }

    @staticmethod
    def _add_months(base_date: datetime.date, months: int):
        month = base_date.month - 1 + months
        year = base_date.year + month // 12
        month = month % 12 + 1
        day = min(base_date.day, [31,
                                   29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
                                   31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
        return datetime.date(year, month, day)

    @staticmethod
    def estimate_promotion_date(student: Student, trend_change: float = 0.0):
        today = timezone.now().date()
        if trend_change <= 0:
            return BeltProgressionService._add_months(today, 3)
        improvement_per_month = max(1.0, trend_change / 3.0)
        months_needed = max(1.0, (100.0 - trend_change) / improvement_per_month)
        return BeltProgressionService._add_months(today, math.ceil(months_needed))

    @staticmethod
    def create_or_update_indicator(student: Student, kata_average: float, kumite_average: float, discipline_average: float, attendance_percentage: float):
        readiness = BeltProgressionService.calculate_readiness(student, kata_average, kumite_average, discipline_average, attendance_percentage)
        indicator, _ = BeltProgressionIndicator.objects.update_or_create(
            student=student,
            defaults={
                'current_belt': student.current_belt_rank,
                'target_belt': BeltProgressionService.get_next_belt(student.current_belt_rank),
                'readiness_status': readiness['readiness_status'],
                'kata_readiness': readiness['kata_readiness'],
                'kumite_readiness': readiness['kumite_readiness'],
                'discipline_readiness': readiness['discipline_readiness'],
                'attendance_readiness': readiness['attendance_readiness'],
                'overall_readiness_percentage': readiness['overall_readiness_percentage'],
                'eligible_since': timezone.now().date() if readiness['readiness_status'] == 'ready' else None,
                'estimated_promotion_date': BeltProgressionService.estimate_promotion_date(student, readiness['overall_readiness_percentage']),
            },
        )
        return indicator


class ProgressionInsightService:
    @staticmethod
    def identify_strengths(student: Student, kata_average: float, kumite_average: float, discipline_average: float):
        metrics = {
            'kata': kata_average,
            'kumite': kumite_average,
            'discipline': discipline_average,
        }
        best = max(metrics, key=metrics.get)
        return best if metrics[best] > 0 else None

    @staticmethod
    def identify_weaknesses(student: Student, kata_average: float, kumite_average: float, discipline_average: float):
        metrics = {
            'kata': kata_average,
            'kumite': kumite_average,
            'discipline': discipline_average,
        }
        worst = min(metrics, key=metrics.get)
        return worst if metrics[worst] > 0 else None

    @staticmethod
    def create_insight(student: Student, insight_type: str, title: str, description: str, metric_name: str, metric_value: float, metric_history: dict, confidence_score: float):
        insight, _ = ProgressionInsight.objects.update_or_create(
            student=student,
            insight_type=insight_type,
            title=title,
            defaults={
                'description': description,
                'metric_name': metric_name,
                'metric_value': metric_value,
                'metric_history': metric_history,
                'confidence_score': confidence_score,
            },
        )
        return insight

    @staticmethod
    def analyze_student_performance(student: Student, months_ahead: int = 3):
        today = timezone.now().date()
        start_date = BeltProgressionService._add_months(today, -3)

        kata_avg = PerformanceAggregationService._safe_average(
            StanceEvaluation.objects.filter(student=student, date_evaluated__gte=start_date).aggregate(avg=Avg('score'))['avg']
        )
        kumite_avg = PerformanceAggregationService._safe_average(
            InstructorRating.objects.filter(student=student, date_evaluated__gte=start_date).aggregate(avg=Avg('kumite_score'))['avg']
        )
        discipline_avg = PerformanceAggregationService._safe_average(
            InstructorRating.objects.filter(student=student, date_evaluated__gte=start_date).aggregate(avg=Avg('discipline_score'))['avg']
        )

        latest_summary = PerformanceSummary.objects.filter(student=student).order_by('-generated_at').first()
        trend_summary = latest_summary.overall_trend if latest_summary else 0.0

        insights = []
        if kata_avg >= kumite_avg and kata_avg >= discipline_avg:
            insights.append(ProgressionInsightService.create_insight(
                student,
                'strength',
                'Strong Kata Progress',
                'Kata performance is currently the strongest area. Keep building consistency in form and technique.',
                'kata_average',
                kata_avg,
                {'last_3_months': kata_avg},
                85.0,
            ))

        if kumite_avg < 70.0:
            insights.append(ProgressionInsightService.create_insight(
                student,
                'weakness',
                'Kumite Focus Needed',
                'Kumite scores are below the readiness threshold. Increase sparring sessions and tactical drills.',
                'kumite_average',
                kumite_avg,
                {'last_3_months': kumite_avg},
                78.0,
            ))

        if trend_summary > 5.0:
            insights.append(ProgressionInsightService.create_insight(
                student,
                'milestone',
                'Upward Progress Trend',
                'Overall performance is improving steadily. Maintain the current training rhythm.',
                'overall_trend',
                trend_summary,
                {'trend': trend_summary},
                80.0,
            ))

        if discipline_avg < 75.0:
            insights.append(ProgressionInsightService.create_insight(
                student,
                'recommendation',
                'Improve Discipline Ratings',
                'Discipline ratings are lower than expected. Encourage focus and class participation.',
                'discipline_average',
                discipline_avg,
                {'last_3_months': discipline_avg},
                75.0,
            ))

        if trend_summary >= 10.0:
            insights.append(ProgressionInsightService.create_insight(
                student,
                'recommendation',
                'Ready for Promotion Review',
                'Progress is strong and consistent. Review belt readiness with the instructor.',
                'overall_trend',
                trend_summary,
                {'trend': trend_summary},
                88.0,
            ))

        return insights


class GamificationService:
    LEVEL_SIZE = 500
    MAX_LEVEL = 20

    @staticmethod
    def calculate_level(xp: int) -> int:
        return max(1, min(GamificationService.MAX_LEVEL, xp // GamificationService.LEVEL_SIZE + 1))

    @staticmethod
    def _safe_average(value):
        return float(value or 0.0)

    @staticmethod
    def _build_student_metrics(student: Student):
        latest_summary = PerformanceSummary.objects.filter(student=student).order_by('-generated_at').first()
        latest_belt = BeltProgressionIndicator.objects.filter(student=student).order_by('-last_assessment_date').first()

        attendance_total = Attendance.objects.filter(student=student).count()
        recent_attendance = Attendance.objects.filter(
            student=student,
            date__gte=timezone.now().date() - datetime.timedelta(days=7),
        ).count()
        streak_days = Attendance.objects.filter(
            student=student,
            date__gte=timezone.now().date() - datetime.timedelta(days=14),
        ).values_list('date', flat=True).distinct().count()

        metrics = {
            'attendance_total': attendance_total,
            'attendance_last_7_days': recent_attendance,
            'streak_days': streak_days,
            'kata_average': latest_summary.kata_average if latest_summary else 0.0,
            'kumite_average': latest_summary.kumite_average if latest_summary else 0.0,
            'discipline_average': latest_summary.discipline_average if latest_summary else 0.0,
            'overall_average': latest_summary.overall_average if latest_summary else 0.0,
            'readiness': latest_belt.overall_readiness_percentage if latest_belt else 0.0,
            'last_activity_date': latest_summary.generated_at.date().isoformat() if latest_summary else None,
        }
        return metrics

    @staticmethod
    def calculate_xp(metrics: dict) -> int:
        xp = 0
        xp += int(metrics['attendance_total'] * 15)
        xp += int(metrics['attendance_last_7_days'] * 10)
        xp += int(metrics['overall_average'] * 10)
        xp += int(metrics['kata_average'] * 5)
        xp += int(metrics['kumite_average'] * 5)
        xp += int(metrics['discipline_average'] * 4)
        xp += int(metrics['readiness'] * 3)
        return min(20000, max(0, xp))

    @staticmethod
    def _badge_earned(badge: BadgeDefinition, metrics: dict) -> bool:
        if badge.criteria_type == 'attendance':
            return metrics['attendance_total'] >= badge.threshold
        if badge.criteria_type == 'kata_score':
            return metrics['kata_average'] >= badge.threshold
        if badge.criteria_type == 'overall_score':
            return metrics['overall_average'] >= badge.threshold
        if badge.criteria_type == 'belt_readiness':
            return metrics['readiness'] >= badge.threshold
        if badge.criteria_type == 'streak':
            return metrics['streak_days'] >= badge.threshold
        return False

    @staticmethod
    def _challenge_status(challenge: ChallengeDefinition, metrics: dict) -> tuple[float, bool]:
        progress = 0.0
        if challenge.slug == 'weekly_warrior':
            progress = metrics['attendance_last_7_days']
        elif challenge.slug == 'kata_perfection':
            progress = 1.0 if metrics['kata_average'] >= challenge.target_value else 0.0
        elif challenge.slug == 'consistency_king':
            progress = metrics['streak_days']
        elif challenge.slug == 'monthly_xp_goal':
            progress = metrics['total_xp']
        else:
            progress = metrics.get('attendance_total', 0)

        completed = progress >= challenge.target_value
        return progress, completed

    @classmethod
    def sync_student_profile(cls, student: Student):
        metrics = cls._build_student_metrics(student)
        total_xp = cls.calculate_xp(metrics)
        level = cls.calculate_level(total_xp)
        current_xp = total_xp - (level - 1) * cls.LEVEL_SIZE
        next_level_xp = level * cls.LEVEL_SIZE

        profile, _ = GamificationProfile.objects.get_or_create(student=student)
        profile.total_xp = total_xp
        profile.level = level
        profile.current_xp = current_xp
        profile.next_level_xp = next_level_xp
        profile.streak_days = int(metrics['streak_days'])
        profile.last_activity_date = metrics['last_activity_date']
        profile.save()

        badge_data = []
        for badge in BadgeDefinition.objects.filter(active=True):
            earned = cls._badge_earned(badge, metrics)
            progress = 0.0
            if badge.criteria_type == 'attendance':
                progress = metrics['attendance_total']
            elif badge.criteria_type == 'kata_score':
                progress = metrics['kata_average']
            elif badge.criteria_type == 'overall_score':
                progress = metrics['overall_average']
            elif badge.criteria_type == 'belt_readiness':
                progress = metrics['readiness']
            elif badge.criteria_type == 'streak':
                progress = metrics['streak_days']

            student_badge, created = StudentBadge.objects.get_or_create(
                student=student,
                badge=badge,
                defaults={
                    'progress_value': progress,
                    'note': badge.description,
                    'earned_at': timezone.now().date() if earned else None,
                },
            )
            if not created:
                student_badge.progress_value = progress
                if earned and not student_badge.earned_at:
                    student_badge.earned_at = timezone.now().date()
                student_badge.note = badge.description
                student_badge.save()

            badge_data.append({
                'id': student_badge.id,
                'earned': earned,
                'badge': {
                    'id': badge.id,
                    'name': badge.name,
                    'slug': badge.slug,
                    'description': badge.description,
                    'icon': badge.icon,
                    'criteria_type': badge.criteria_type,
                    'threshold': badge.threshold,
                    'reward_xp': badge.reward_xp,
                },
                'earned_at': student_badge.earned_at.isoformat() if (earned and student_badge.earned_at) else None,
                'progress_value': student_badge.progress_value,
            })

        challenge_data = []
        for challenge in ChallengeDefinition.objects.filter(active=True):
            progress, completed = cls._challenge_status(challenge, {**metrics, 'total_xp': total_xp})
            student_challenge, _ = StudentChallenge.objects.update_or_create(
                student=student,
                challenge=challenge,
                defaults={
                    'progress': progress,
                    'completed_at': timezone.now().date() if completed else None,
                },
            )
            challenge_data.append({
                'id': student_challenge.id,
                'challenge': {
                    'id': challenge.id,
                    'name': challenge.name,
                    'slug': challenge.slug,
                    'description': challenge.description,
                    'icon': challenge.icon,
                    'target_value': challenge.target_value,
                    'reward_xp': challenge.reward_xp,
                },
                'progress': student_challenge.progress,
                'completed_at': student_challenge.completed_at.isoformat() if student_challenge.completed_at else None,
                'reward_claimed': student_challenge.reward_claimed,
            })

        return {
            'profile': profile,
            'xp': {
                'total_xp': profile.total_xp,
                'level': profile.level,
                'current_xp': profile.current_xp,
                'next_level_xp': profile.next_level_xp,
                'streak_days': profile.streak_days,
                'last_activity_date': profile.last_activity_date if isinstance(profile.last_activity_date, str) else (profile.last_activity_date.isoformat() if profile.last_activity_date else None),
            },
            'badges': badge_data,
            'challenges': challenge_data,
            'metrics': metrics,
        }

    @classmethod
    def get_leaderboard(cls, limit: int = 10):
        profiles = GamificationProfile.objects.select_related('student').order_by('-total_xp')[:limit]
        leaderboard = []
        rank = 1
        for profile in profiles:
            leaderboard.append({
                'rank': rank,
                'student_id': profile.student.student_id,
                'name': f"{profile.student.first_name} {profile.student.last_name}",
                'xp': profile.total_xp,
                'total_xp': profile.total_xp,
                'current_xp': profile.current_xp,
                'next_level_xp': profile.next_level_xp,
                'level': profile.level,
                'belt': profile.student.current_belt_rank,
                'current_belt_rank': profile.student.current_belt_rank,
            })
            rank += 1
        return leaderboard
