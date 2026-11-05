import datetime
import math

from django.db import transaction
from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone

from ..models import (
    Attendance,
    BadgeDefinition,
    GamificationProfile,
    InstructorRating,
    KataRating,
    KumiteRating,
    SparringMatch,
    PerformanceSummary,
    Session,
    Student,
    StudentBadge,
    StanceEvaluation,
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
    def _get_promotion_cutoff_date(student: Student):
        from ..models import BeltProgressionArchive

        archive = BeltProgressionArchive.objects.filter(student=student).order_by('-promotion_date').first()
        return archive.promotion_date if archive else None

    @staticmethod
    def _apply_promotion_cutoff(student: Student, date_from, date_to):
        promotion_date = PerformanceAggregationService._get_promotion_cutoff_date(student)
        if promotion_date:
            cutoff_start = promotion_date + datetime.timedelta(days=1)
            if cutoff_start > date_to:
                return date_to, date_to
            return max(date_from, cutoff_start), date_to
        return date_from, date_to

    @staticmethod
    def _build_empty_kata_rating(student: Student, month_year: str):
        return KataRating(
            student=student,
            pose_evaluation_avg=0.0,
            instructor_kata_score=0.0,
            combined_kata_score=0.0,
            date_recorded=timezone.now().date(),
            month_year=month_year,
        )

    @staticmethod
    def _build_empty_kumite_rating(student: Student, month_year: str):
        return KumiteRating(
            student=student,
            match_avg_score=0.0,
            instructor_kumite_score=0.0,
            combined_kumite_score=0.0,
            wins=0,
            losses=0,
            date_recorded=timezone.now().date(),
            month_year=month_year,
        )

    @staticmethod
    def _build_empty_performance_summary(student: Student, date_from, date_to, period='monthly'):
        return PerformanceSummary(
            student=student,
            period=period,
            start_date=date_from,
            end_date=date_to,
            kata_average=0.0,
            kumite_average=0.0,
            discipline_average=0.0,
            overall_average=0.0,
            kata_trend=0.0,
            kumite_trend=0.0,
            discipline_trend=0.0,
            overall_trend=0.0,
            sessions_attended=0,
            evaluations_count=0,
            matches_participated=0,
        )

    @staticmethod
    def compute_current_kata_rating(student: Student, start_date=None, end_date=None):
        date_from, date_to = PerformanceAggregationService._build_date_range('monthly', start_date, end_date)
        date_from, date_to = PerformanceAggregationService._apply_promotion_cutoff(student, date_from, date_to)
        pose_evals = StanceEvaluation.objects.filter(
            student=student,
            date_evaluated__range=(date_from, date_to),
        )
        instructor_ratings = InstructorRating.objects.filter(
            student=student,
            date_evaluated__range=(date_from, date_to),
        )

        if not pose_evals.exists() and not instructor_ratings.exists():
            if PerformanceAggregationService._get_promotion_cutoff_date(student):
                return PerformanceAggregationService._build_empty_kata_rating(student, date_from.strftime('%Y-%m'))
            return None

        pose_avg = pose_evals.aggregate(avg=Avg('score'))['avg']
        pose_avg = float(pose_avg or 0.0)

        instructor_avg = instructor_ratings.aggregate(avg=Avg('kata_score'))['avg']
        instructor_avg = float(instructor_avg or 0.0)

        combined = 0.0
        if pose_avg or instructor_avg:
            combined = (pose_avg + instructor_avg) / 2.0

        rating = KataRating(
            student=student,
            pose_evaluation_avg=pose_avg,
            instructor_kata_score=instructor_avg,
            combined_kata_score=combined,
            date_recorded=timezone.now().date(),
            month_year=date_from.strftime('%Y-%m'),
        )
        return rating

    @staticmethod
    def _calculate_sparring_metrics(student: Student, date_from, date_to):
        matches = SparringMatch.objects.filter(
            Q(student_a=student) | Q(student_b=student),
            match_date__range=(date_from, date_to),
            status='completed',
        )

        total_matches = matches.count()
        total_score = 0.0
        wins = 0
        losses = 0

        for student_a_id, student_b_id, score_a, score_b in matches.values_list(
            'student_a_id', 'student_b_id', 'score_a', 'score_b'
        ):
            if student_a_id == student.student_id:
                total_score += float(score_a or 0)
                if score_a is not None and score_b is not None and score_a > score_b:
                    wins += 1
                elif score_a is not None and score_b is not None and score_a < score_b:
                    losses += 1
            elif student_b_id == student.student_id:
                total_score += float(score_b or 0)
                if score_a is not None and score_b is not None and score_b > score_a:
                    wins += 1
                elif score_a is not None and score_b is not None and score_b < score_a:
                    losses += 1

        match_avg = float(total_score / total_matches) if total_matches else 0.0

        return match_avg, wins, losses

    @staticmethod
    def get_current_belt_sparring_record(student: Student, end_date=None):
        from ..models import BeltProgressionArchive

        end_date = end_date or timezone.localdate()
        latest_promotion = BeltProgressionArchive.objects.filter(
            student=student,
        ).order_by('-promotion_date').first()
        matches = SparringMatch.objects.filter(
            Q(student_a=student) | Q(student_b=student),
            match_date__lte=end_date,
            status='completed',
        )
        if latest_promotion:
            matches = matches.filter(match_date__gt=latest_promotion.promotion_date)

        total_score = 0
        total_matches = 0
        wins = 0
        losses = 0
        for student_a_id, score_a, score_b in matches.values_list(
            'student_a_id', 'score_a', 'score_b'
        ):
            student_score, opponent_score = (
                (score_a, score_b)
                if student_a_id == student.student_id
                else (score_b, score_a)
            )
            total_score += student_score
            total_matches += 1
            if student_score > opponent_score:
                wins += 1
            elif student_score < opponent_score:
                losses += 1

        return {
            'match_average': total_score / total_matches if total_matches else 0.0,
            'wins': wins,
            'losses': losses,
        }

    @staticmethod
    def get_current_belt_instructor_kumite_average(student: Student, end_date=None):
        from ..models import BeltProgressionArchive

        end_date = end_date or timezone.localdate()
        instructor_ratings = InstructorRating.objects.filter(
            student=student,
            date_evaluated__lte=end_date,
        )
        latest_promotion = BeltProgressionArchive.objects.filter(
            student=student,
        ).order_by('-promotion_date').first()
        if latest_promotion:
            instructor_ratings = instructor_ratings.filter(
                date_evaluated__gt=latest_promotion.promotion_date,
            )

        average = instructor_ratings.aggregate(avg=Avg('kumite_score'))['avg']
        return float(average or 0.0)

    def compute_current_kumite_rating(student: Student, start_date=None, end_date=None):
        date_from, date_to = PerformanceAggregationService._build_date_range('monthly', start_date, end_date)
        date_from, date_to = PerformanceAggregationService._apply_promotion_cutoff(student, date_from, date_to)
        match_avg, wins, losses = PerformanceAggregationService._calculate_sparring_metrics(student, date_from, date_to)
        instructor_ratings = InstructorRating.objects.filter(
            student=student,
            date_evaluated__range=(date_from, date_to),
        )

        if match_avg == 0.0 and not instructor_ratings.exists():
            return PerformanceAggregationService._build_empty_kumite_rating(student, date_from.strftime('%Y-%m'))

        instructor_avg = instructor_ratings.aggregate(avg=Avg('kumite_score'))['avg']
        instructor_avg = float(instructor_avg or 0.0)

        combined = 0.0
        if match_avg or instructor_avg:
            combined = (match_avg + instructor_avg) / 2.0

        rating = KumiteRating(
            student=student,
            match_avg_score=match_avg,
            instructor_kumite_score=instructor_avg,
            combined_kumite_score=combined,
            wins=wins,
            losses=losses,
            date_recorded=timezone.now().date(),
            month_year=date_from.strftime('%Y-%m'),
        )
        return rating

    @staticmethod
    def aggregate_kata_score(student: Student, start_date=None, end_date=None):
        date_from, date_to = PerformanceAggregationService._build_date_range('monthly', start_date, end_date)
        date_from, date_to = PerformanceAggregationService._apply_promotion_cutoff(student, date_from, date_to)
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
        date_from, date_to = PerformanceAggregationService._apply_promotion_cutoff(student, date_from, date_to)
        match_avg, wins, losses = PerformanceAggregationService._calculate_sparring_metrics(student, date_from, date_to)

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
        date_from, date_to = PerformanceAggregationService._apply_promotion_cutoff(student, date_from, date_to)
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
            time_in__isnull=False,
        ).count()
        evaluations_count = StanceEvaluation.objects.filter(student=student, date_evaluated__range=(date_from, date_to)).count() + InstructorRating.objects.filter(student=student, date_evaluated__range=(date_from, date_to)).count()
        matches_participated = SparringMatch.objects.filter(
            Q(student_a=student) | Q(student_b=student),
            match_date__range=(date_from, date_to),
        ).count()

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
        )
        return summary

    @staticmethod
    def calculate_attendance_percentage(student: Student, start_date, end_date):
        date_from, date_to = PerformanceAggregationService._apply_promotion_cutoff(student, start_date, end_date)
        total_sessions = Session.objects.filter(date__range=(date_from, date_to)).count()
        attended_sessions = Attendance.objects.filter(
            student=student,
            date__range=(date_from, date_to),
            time_in__isnull=False,
        ).count()
        if total_sessions == 0:
            return 0.0
        return float(min(100.0, (attended_sessions / total_sessions) * 100.0))

    @staticmethod
    def compute_current_performance_summary(student: Student, period: str = 'monthly', start_date=None, end_date=None):
        date_from, date_to = PerformanceAggregationService._build_date_range(period, start_date, end_date)
        date_from, date_to = PerformanceAggregationService._apply_promotion_cutoff(student, date_from, date_to)
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
            time_in__isnull=False,
        ).count()
        evaluations_count = StanceEvaluation.objects.filter(student=student, date_evaluated__range=(date_from, date_to)).count() + InstructorRating.objects.filter(student=student, date_evaluated__range=(date_from, date_to)).count()
        matches_participated = SparringMatch.objects.filter(
            Q(student_a=student) | Q(student_b=student),
            match_date__range=(date_from, date_to),
        ).count()

        return PerformanceSummary(
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
        )

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
            PerformanceAggregationService.get_current_belt_instructor_kumite_average(student),
            performance_summary.discipline_average,
            attendance_percentage,
        )
        return {
            'kata_rating': kata_rating,
            'kumite_rating': kumite_rating,
            'performance_summary': performance_summary,
            'belt_progression_indicator': belt_indicator,
        }

    @staticmethod
    def generate_per_session_performance_trend(num_sessions: int = 6):
        """Generate performance trend data aggregated per session with exact dates."""
        from django.db.models import Q, Avg
        
        # Get unique session dates with performance evaluations
        session_dates = set()
        
        # Collect dates from all evaluation types
        for eval_date in StanceEvaluation.objects.values_list('date_evaluated', flat=True).distinct().order_by('-date_evaluated')[:num_sessions]:
            if eval_date:
                session_dates.add(eval_date)
        
        for eval_date in InstructorRating.objects.values_list('date_evaluated', flat=True).distinct().order_by('-date_evaluated')[:num_sessions]:
            if eval_date:
                session_dates.add(eval_date)
        
        for eval_date in KataRating.objects.values_list('date_recorded', flat=True).distinct().order_by('-date_recorded')[:num_sessions]:
            if eval_date:
                session_dates.add(eval_date)
        
        for eval_date in KumiteRating.objects.values_list('date_recorded', flat=True).distinct().order_by('-date_recorded')[:num_sessions]:
            if eval_date:
                session_dates.add(eval_date)
        
        # Sort dates and take the last num_sessions
        sorted_dates = sorted(list(session_dates), reverse=True)[:num_sessions]
        sorted_dates = sorted(sorted_dates)  # Re-sort ascending for display
        
        performance_trend = []
        
        for eval_date in sorted_dates:
            # Calculate average performance across all evaluations on this date
            kata_evals = StanceEvaluation.objects.filter(date_evaluated=eval_date).aggregate(avg_score=Avg('score'))['avg_score'] or 0.0
            
            instructor_ratings = InstructorRating.objects.filter(date_evaluated=eval_date).aggregate(
                avg_kata=Avg('kata_score'),
                avg_kumite=Avg('kumite_score'),
                avg_discipline=Avg('discipline_score')
            )
            
            avg_kata = (instructor_ratings['avg_kata'] or 0.0) / 100.0 * 100 if instructor_ratings['avg_kata'] else 0.0
            avg_kumite = (instructor_ratings['avg_kumite'] or 0.0) / 100.0 * 100 if instructor_ratings['avg_kumite'] else 0.0
            avg_discipline = (instructor_ratings['avg_discipline'] or 0.0) / 100.0 * 100 if instructor_ratings['avg_discipline'] else 0.0
            
            # Calculate overall average
            scores = [kata_evals, avg_kata, avg_kumite, avg_discipline]
            valid_scores = [s for s in scores if s > 0]
            overall_average = sum(valid_scores) / len(valid_scores) if valid_scores else 0.0
            
            performance_trend.append({
                'period': eval_date.strftime('%Y-%m-%d'),
                'overall_average': float(overall_average),
                'date': eval_date,
            })
        
        return performance_trend

    @staticmethod
    def generate_pose_evaluation_trend_per_session(num_sessions: int = 5):
        """Generate pose evaluation average per session date for the last N sessions."""
        session_dates = list(
            StanceEvaluation.objects.values_list('date_evaluated', flat=True)
            .distinct()
            .order_by('-date_evaluated')[:num_sessions]
        )
        session_dates = sorted(session_dates)

        trend = []
        for session_date in session_dates:
            avg_pose = StanceEvaluation.objects.filter(date_evaluated=session_date).aggregate(avg_score=Avg('score'))['avg_score'] or 0.0
            trend.append({
                'session_date': session_date.strftime('%Y-%m-%d'),
                'avg_pose_score': float(round(avg_pose, 1)),
            })
        return trend

    @staticmethod
    def generate_sparring_kumite_score_trend(num_dates: int = 5):
        """Generate average kumite score per sparring match date for the last N dates."""
        match_dates = list(
            SparringMatch.objects.filter(status='completed')
            .values_list('match_date', flat=True)
            .distinct()
            .order_by('-match_date')[:num_dates]
        )
        match_dates = sorted(match_dates)

        trend = []
        for match_date in match_dates:
            stats = SparringMatch.objects.filter(match_date=match_date, status='completed').aggregate(
                total_score_a=Sum('score_a'),
                total_score_b=Sum('score_b'),
                match_count=Count('pk'),
            )
            total_score_a = float(stats['total_score_a'] or 0.0)
            total_score_b = float(stats['total_score_b'] or 0.0)
            match_count = stats['match_count'] or 0
            avg_kumite = (total_score_a + total_score_b) / (match_count * 2) if match_count else 0.0

            trend.append({
                'match_date': match_date.strftime('%Y-%m-%d'),
                'avg_kumite_score': float(round(avg_kumite, 1)),
            })
        return trend

    @staticmethod
    def generate_per_session_attendance_trend(num_sessions: int = 6):
        """Generate attendance trend data per individual session with exact dates and times."""
        # Get the last N sessions (ordered by date and time)
        sessions = Session.objects.all().order_by('-date', '-start_time')[:num_sessions]
        sessions = list(reversed(sessions))  # Reverse to get ascending order
        
        attendance_trend = []
        
        for session in sessions:
            # Count only present attendance records for this specific session
            attendance_count = Attendance.objects.filter(session=session, time_in__isnull=False).count()
            
            # Format date with time for clarity
            session_datetime = f"{session.date.strftime('%Y-%m-%d')} {session.start_time.strftime('%H:%M')}"
            
            attendance_trend.append({
                'date': session_datetime,
                'attendance': attendance_count,
                'session_id': session.session_id,
            })
        
        return attendance_trend


from ..belt_progression import BELT_LEVELS, get_next_belt as get_next_belt_util, get_belt_level_number


class BeltProgressionService:
    # Use the official belt order from constants
    BELT_ORDER = BELT_LEVELS

    DEFAULT_REQUIREMENTS = {
        'kata': 75.0,
        'kumite': 70.0,
        'discipline': 80.0,
        'attendance': 85.0,
    }

    @staticmethod
    def get_next_belt(current_belt: str):
        if not current_belt:
            return BELT_LEVELS[0]  # White Belt
        return get_next_belt_util(current_belt)

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
    def estimate_promotion_date(student: Student, readiness_percent: float = 0.0):
        """
        Estimate the promotion date for a student.

        Priority:
        - If the student is eligible (high readiness) and there is a scheduled 'belt' session
          (belt exam/promotion) in the future, return that session date.
        - Otherwise return an exact date offset by the promotion interval (3 or 6 months)
          determined by the student's current belt progression.

        Args:
            student: Student instance
            readiness_percent: overall readiness percentage (0-100)

        Returns:
            datetime.date: estimated promotion date
        """
        today = timezone.now().date()

        # If student is ready for promotion, prefer the next scheduled belt exam/session
        try:
            if readiness_percent >= 95.0:
                next_promotion_session = (
                    Session.objects.filter(
                        Q(session_type__icontains='belt') | Q(session_type__icontains='promotion'),
                        date__gte=today,
                    )
                    .order_by('date')
                    .first()
                )
                if next_promotion_session:
                    return next_promotion_session.date
        except Exception:
            # if Session model lookup fails for any reason, fall back to date math below
            pass

        # Determine interval: default promotion cadence is 3 months; for higher belts use 6 months
        try:
            level_num = get_belt_level_number(student.current_belt_rank or '')
        except Exception:
            level_num = 0

        months = 6 if level_num >= 7 else 3
        return BeltProgressionService._add_months(today, months)

    @staticmethod
    def archive_promotion_and_reset(indicator: PerformanceSummary):
        """
        Archive the current progression data and reset for new belt level.
        
        This archives the current progression data to BeltProgressionArchive.
        
        Args:
            indicator: The belt-progression summary being promoted
            
        Returns:
            BeltProgressionArchive: The archived progression record
        """
        from ..models import (
            BeltProgressionArchive,
            KataRating,
            KumiteRating,
            PerformanceSummary,
        )
        
        student = indicator.student
        today = timezone.now().date()
        
        # Fetch related rating data to archive
        latest_kata = KataRating.objects.filter(student=student).order_by('-date_recorded').first()
        latest_kumite = KumiteRating.objects.filter(student=student).order_by('-date_recorded').first()
        latest_summary = PerformanceSummary.objects.filter(student=student).exclude(
            period=PerformanceSummary.BELT_PROGRESSION_PERIOD,
        ).order_by('-generated_at').first()
        
        # Create archive entry with snapshot of progression data
        archive = BeltProgressionArchive.objects.create(
            student=student,
            archived_belt=student.current_belt_rank,
            kata_readiness=indicator.kata_readiness,
            kumite_readiness=indicator.kumite_readiness,
            discipline_readiness=indicator.discipline_readiness,
            overall_readiness_percentage=indicator.overall_readiness_percentage,
            kata_rating_data={
                'pose_evaluation_avg': latest_kata.pose_evaluation_avg if latest_kata else 0.0,
                'instructor_kata_score': latest_kata.instructor_kata_score if latest_kata else 0.0,
                'combined_kata_score': latest_kata.combined_kata_score if latest_kata else 0.0,
                'date_recorded': latest_kata.date_recorded.isoformat() if latest_kata else None,
            } if latest_kata else None,
            kumite_rating_data={
                'match_avg_score': latest_kumite.match_avg_score if latest_kumite else 0.0,
                'instructor_kumite_score': latest_kumite.instructor_kumite_score if latest_kumite else 0.0,
                'combined_kumite_score': latest_kumite.combined_kumite_score if latest_kumite else 0.0,
                'wins': latest_kumite.wins if latest_kumite else 0,
                'losses': latest_kumite.losses if latest_kumite else 0,
                'date_recorded': latest_kumite.date_recorded.isoformat() if latest_kumite else None,
            } if latest_kumite else None,
            performance_summary_data={
                'period': latest_summary.period if latest_summary else 'overall',
                'kata_average': latest_summary.kata_average if latest_summary else 0.0,
                'kumite_average': latest_summary.kumite_average if latest_summary else 0.0,
                'discipline_average': latest_summary.discipline_average if latest_summary else 0.0,
                'overall_average': latest_summary.overall_average if latest_summary else 0.0,
                'generated_at': latest_summary.generated_at.isoformat() if latest_summary else None,
            } if latest_summary else None,
        )
        
        return archive

    @staticmethod
    @transaction.atomic
    def promote_student(indicator_id: int):
        indicator = PerformanceSummary.objects.select_for_update().select_related(
            'student',
        ).get(
            pk=indicator_id,
            period=PerformanceSummary.BELT_PROGRESSION_PERIOD,
        )
        student = Student.objects.select_for_update().get(pk=indicator.student_id)
        if indicator.readiness_status != 'ready' and (indicator.overall_readiness_percentage or 0) < 100:
            raise ValueError('Student is not ready for belt promotion.')

        promoted_to = BeltProgressionService.get_next_belt(student.current_belt_rank)
        if promoted_to == student.current_belt_rank:
            raise ValueError('Student is already at the highest belt level.')

        archive = BeltProgressionService.archive_promotion_and_reset(indicator)
        student.current_belt_rank = promoted_to
        student.save(update_fields=['current_belt_rank'])

        today = timezone.localdate()
        indicator.start_date = today
        indicator.end_date = today
        indicator.last_assessment_date = today
        indicator.target_belt = BeltProgressionService.get_next_belt(promoted_to)
        indicator.readiness_status = 'not_ready'
        indicator.kata_average = 0
        indicator.kumite_average = 0
        indicator.discipline_average = 0
        indicator.overall_average = 0
        indicator.kata_readiness = 0
        indicator.kumite_readiness = 0
        indicator.discipline_readiness = 0
        indicator.attendance_readiness = 0
        indicator.overall_readiness_percentage = 0
        indicator.eligible_since = None
        indicator.save(update_fields=[
            'start_date',
            'end_date',
            'last_assessment_date',
            'target_belt',
            'readiness_status',
            'kata_average',
            'kumite_average',
            'discipline_average',
            'overall_average',
            'kata_readiness',
            'kumite_readiness',
            'discipline_readiness',
            'attendance_readiness',
            'overall_readiness_percentage',
            'eligible_since',
            'generated_at',
        ])
        return {'promoted_to': promoted_to, 'archive': archive, 'indicator': indicator}

    @staticmethod
    def create_or_update_indicator(student: Student, kata_average: float, kumite_average: float, discipline_average: float, attendance_percentage: float):
        readiness = BeltProgressionService.calculate_readiness(student, kata_average, kumite_average, discipline_average, attendance_percentage)
        today = timezone.now().date()
        indicator, _ = PerformanceSummary.objects.update_or_create(
            student=student,
            period=PerformanceSummary.BELT_PROGRESSION_PERIOD,
            defaults={
                'start_date': today,
                'end_date': today,
                'last_assessment_date': today,
                'target_belt': BeltProgressionService.get_next_belt(student.current_belt_rank),
                'readiness_status': readiness['readiness_status'],
                'kata_readiness': readiness['kata_readiness'],
                'kumite_readiness': readiness['kumite_readiness'],
                'discipline_readiness': readiness['discipline_readiness'],
                'attendance_readiness': readiness['attendance_readiness'],
                'overall_readiness_percentage': readiness['overall_readiness_percentage'],
                'kata_requirement': BeltProgressionService.DEFAULT_REQUIREMENTS['kata'],
                'kumite_requirement': BeltProgressionService.DEFAULT_REQUIREMENTS['kumite'],
                'discipline_requirement': BeltProgressionService.DEFAULT_REQUIREMENTS['discipline'],
                'attendance_requirement': BeltProgressionService.DEFAULT_REQUIREMENTS['attendance'],
                'eligible_since': timezone.now().date() if readiness['readiness_status'] == 'ready' else None,
            },
        )
        return indicator


class GamificationService:
    @staticmethod
    def _safe_average(value):
        return float(value or 0.0)

    @staticmethod
    def _build_student_metrics(student: Student):
        latest_summary = PerformanceSummary.objects.filter(student=student).exclude(
            period=PerformanceSummary.BELT_PROGRESSION_PERIOD,
        ).order_by('-generated_at').first()
        latest_belt = PerformanceSummary.objects.filter(
            student=student,
            period=PerformanceSummary.BELT_PROGRESSION_PERIOD,
        ).order_by('-last_assessment_date').first()

        attendance_total = Attendance.objects.filter(student=student, time_in__isnull=False).count()
        attendance_dates = list(Attendance.objects.filter(
            student=student,
            time_in__isnull=False,
            date__lte=timezone.now().date(),
        ).values_list('date', flat=True).distinct().order_by('-date'))
        today = timezone.now().date()
        streak_days = 0
        expected_date = today if attendance_dates and attendance_dates[0] == today else today - datetime.timedelta(days=1)
        for attendance_date in attendance_dates:
            if attendance_date != expected_date:
                break
            streak_days += 1
            expected_date -= datetime.timedelta(days=1)

        metrics = {
            'attendance_total': attendance_total,
            'streak_days': streak_days,
            'kata_average': latest_summary.kata_average if latest_summary else 0.0,
            'kumite_average': latest_summary.kumite_average if latest_summary else 0.0,
            'discipline_average': latest_summary.discipline_average if latest_summary else 0.0,
            'overall_average': latest_summary.overall_average if latest_summary else 0.0,
            'readiness': latest_belt.overall_readiness_percentage if latest_belt else 0.0,
            'last_activity_date': attendance_dates[0].isoformat() if attendance_dates else None,
        }
        return metrics

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

    @classmethod
    def sync_student_profile(cls, student: Student):
        metrics = cls._build_student_metrics(student)

        profile, _ = GamificationProfile.objects.get_or_create(student=student)
        profile.streak_days = int(metrics['streak_days'])
        profile.last_activity_date = metrics['last_activity_date']
        profile.save(update_fields=['streak_days', 'last_activity_date', 'updated_at'])

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
                },
                'earned_at': student_badge.earned_at.isoformat() if (earned and student_badge.earned_at) else None,
                'progress_value': student_badge.progress_value,
            })

        return {
            'profile': profile,
            'badges': badge_data,
            'metrics': metrics,
        }

    @classmethod
    def get_leaderboard(cls, limit=10):
        students = Student.objects.filter(
            role='Student',
            status='active',
        ).annotate(
            earned_badge_count=Count(
                'student_badges',
                filter=Q(student_badges__earned_at__isnull=False, student_badges__badge__active=True),
            ),
        ).order_by('-earned_badge_count', 'first_name', 'last_name', 'student_id')
        if limit is not None:
            students = students[:limit]

        leaderboard = []
        rank = 1
        for student in students:
            earned_badge_count = student.earned_badge_count
            leaderboard.append({
                'rank': rank,
                'student_id': student.student_id,
                'name': f"{student.first_name} {student.last_name}",
                'badge_count': earned_badge_count,
                'belt': student.current_belt_rank,
                'current_belt_rank': student.current_belt_rank,
            })
            rank += 1
        return leaderboard

    @classmethod
    def get_monthly_leaderboard(cls):
        today = timezone.localdate()
        month_start = today.replace(day=1)
        students = Student.objects.filter(
            role='Student',
            status='active',
        ).annotate(
            earned_badge_count=Count(
                'student_badges',
                filter=Q(student_badges__earned_at__isnull=False, student_badges__badge__active=True),
            ),
            monthly_badge_count=Count(
                'student_badges',
                filter=Q(
                    student_badges__earned_at__gte=month_start,
                    student_badges__earned_at__lte=today,
                    student_badges__badge__active=True,
                ),
            ),
        ).filter(
            monthly_badge_count__gt=0,
        ).order_by('-monthly_badge_count', '-earned_badge_count', 'first_name', 'last_name', 'student_id')

        leaderboard = []
        for rank, student in enumerate(students, start=1):
            leaderboard.append({
                'rank': rank,
                'student_id': student.student_id,
                'name': f"{student.first_name} {student.last_name}",
                'badge_count': student.earned_badge_count,
                'previous_badge_count': student.earned_badge_count - student.monthly_badge_count,
                'monthly_badge_count': student.monthly_badge_count,
                'belt': student.current_belt_rank,
                'current_belt_rank': student.current_belt_rank,
            })
        return leaderboard
