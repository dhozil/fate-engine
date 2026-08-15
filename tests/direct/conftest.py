import pytest


@pytest.fixture(autouse=True)
def _enable_pickling_check(direct_vm):
    """Enable GenVM pickling validation for every direct test.

    Production GenLayer pickles the leader/validator closures before sending
    them to validators; an unpicklable closure fails in the real GENVM. This
    mirrors the "GENVM lint" for non-deterministic blocks. Requires the
    optional cloudpickle package; skipped when it is not installed.
    """
    try:
        import cloudpickle  # noqa: F401
    except ImportError:
        yield
        return
    direct_vm.check_pickling = True
    yield
