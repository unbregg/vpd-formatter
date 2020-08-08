<script>
const promsBudgetsBudgetList = namespace("PROMS_BUDGETS/BUDGET_LIST")
import { namespace } from "vuex-class";
// @ts-nocheck
import Vue from "vue";
import Component from "vue-class-component";
import { mapState, mapActions, mapGetters } from "vuex";
import qs from "qs";
import axios from "@/pages/proms/services/apiService";
import { BudgetStatus, BudgetOp, PreStatusEnum, } from "@/typings/models/proms.d.ts";
import "./store";
import "../../MyBudgets/store";
const BUDGET_STATUS_DESC_MAP = {
    [BudgetStatus.INIT]: "初始化",
    [BudgetStatus.TO_BE_CONFIG]: "待配置",
    [BudgetStatus.TO_BE_APPROVE_LV1]: "待一级审批",
    [BudgetStatus.REJECTED_LV1]: "一级审批驳回",
    [BudgetStatus.TO_BE_APPROVE_LV2]: "待二级审批",
    [BudgetStatus.REJECTED_LV2]: "二级审批驳回",
    [BudgetStatus.TO_BE_APPROVE_LV3]: "待三级审批",
    [BudgetStatus.REJECTED_LV3]: "三级审批驳回",
    [BudgetStatus.TO_BE_ADJUST]: "待调整",
    [BudgetStatus.END]: "已结束",
};
// 新发起的（在审批流中）预测业务的状态映射
const NEW_BUDGET_STATUS_DESC_MAP = {
    [PreStatusEnum.INIT]: "初始化",
    [PreStatusEnum.PROCESSING]: "进行中",
    [PreStatusEnum.FINISHED]: "已结束",
};
@Component
export default class BudgetList extends Vue {
    @promsBudgetsBudgetList.State("budgetLoading")
    budgetLoading;
    @promsBudgetsBudgetList.State("pager")
    pager;
    @promsBudgetsBudgetList.State("budgetList")
    budgetList;
    @PlanModule.Getter(PLAN_MODULE.GET_LESSON_METHODS)
    lessonMethods: EnumType;
    BudgetOp: any = BudgetOp;
    BudgetStatus: any = BudgetStatus;
    BUDGET_STATUS_DESC_MAP: any = BUDGET_STATUS_DESC_MAP;
    NEW_BUDGET_STATUS_DESC_MAP = NEW_BUDGET_STATUS_DESC_MAP;
    query: {} = { budget: { name: "", version: "" } };
    columns: {
        title: string;
        key?: string;
        slot?: string;
        width?: number;
    }[] = [
        { title: "序号", slot: "index", width: 60 },
        { title: "方案", key: "budgetName", width: 150 },
        { title: "版本", key: "version", width: 60 },
        { title: "处理人", key: "operator", width: 80 },
        { title: "处理时间", slot: "handleTime", width: 160 },
        { title: "描述", slot: "desc" },
        { title: "是否锁定", key: "lockStatusStr" },
        { title: "状态", slot: "status", width: 110 },
        { title: "操作", slot: "op" },
    ];
    handleQueryClick() {
        (this as any).updateQuery(this.query);
        (this as any).doQuery();
    }
    handleDelete(row: any) {
        this.$Modal.confirm({
            title: "删除确认",
            content: `是否删除【${row.budgetName}-${row.version}】`,
            onOk: () => {
                axios
                    .post("deleteBudget", qs.stringify({ budgetId: row.id }))
                    .then(({ data }) => {
                    if (data) {
                        this.handleDeleteSuccess();
                    }
                    else {
                        this.handleDeleteFail("删除失败，点击确认刷新列表");
                    }
                })
                    .catch((err: any) => {
                    this.handleDeleteFail(err.message || "");
                });
            },
        });
    }
    handleLock(row: any) {
        axios
            .get(`budgetlock/checkBudgetLock?budgetId=${row.id}`, {
            loading: true,
        } as any)
            .then((response) => {
            const isLocked = response.data;
            const lockModalContent = `请您确定要${response.data ? "变更" : ""}锁定【${row.budgetName}-${row.version}】吗？`;
            this.$Modal.confirm({
                title: "锁定",
                content: `${lockModalContent}`,
                width: "500",
                onOk: () => {
                    axios
                        .post("budgetlock/lockBudget", qs.stringify({ budgetId: row.id }), { loading: true } as any)
                        .then(({ data }) => {
                        if (data) {
                            this.$Message.success(`${isLocked ? "变更" : ""}锁定操作成功`);
                            (this as any).doQuery();
                        }
                        else {
                            this.$Message.error(`${isLocked ? "变更" : ""}锁定操作失败`);
                        }
                    });
                },
            });
        });
    }
    handleDeleteSuccess() {
        this.$Modal.success({
            title: "删除成功",
            content: "删除成功，点击确认刷新列表",
            onOk: () => {
                (this as any).doQuery();
            },
        });
    }
    handleDeleteFail(message) {
        this.$Modal.error({
            title: "删除失败",
            content: message,
            onOk: () => {
                (this as any).doQuery();
            },
        });
    }
    methods: {
        ...mapActions("PROMS_BUDGETS/BUDGET_LIST", ["updateQuery", "doQuery"]),
    }
    created() {
        this.query = this.queryInStore;
        this.doQuery();
    }
}
</script>