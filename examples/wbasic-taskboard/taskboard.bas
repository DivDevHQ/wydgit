PUBLIC CLASS Taskboard EXTENDS wydgit.core/section
    META Id = "divdev/taskboard"
    PUBLIC PROPERTY CurrentPage AS Number = 1
    PUBLIC PROPERTY LoadCount AS Number = 0
    CHILD Model AS "divdev/task-model" INTO blocks
    END CHILD
    CHILD List AS "divdev/task-list" INTO blocks
    END CHILD
    CHILD Pager AS "divdev/task-navigation" INTO blocks
    END CHILD
    PUBLIC SUB SelectPage(PageNumber AS Integer)
        Me.Pager.GoToPage(PageNumber)
    END SUB
    PRIVATE SUB ApplyPage()
        Me.List.Tasks = Me.Model.LoadTasks(Me.CurrentPage)
    END SUB
    PRIVATE SUB OnPageChanged(PageNumber AS Integer)
        Me.CurrentPage = PageNumber
        Me.ApplyPage()
    END SUB
    PRIVATE SUB OnPageLoad()
        Me.LoadCount = Me.LoadCount + 1
    END SUB
    BIND EVENT Pager.PageChanged TO Me.OnPageChanged
    BIND EVENT Page.Load TO Me.OnPageLoad
    PROTECTED OVERRIDE SUB Preload()
        Me.ApplyPage()
    END SUB
END CLASS
