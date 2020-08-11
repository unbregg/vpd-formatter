<template lang="pug">
PromsLayout.budget-list
  div(slot="title") 我的预测
  div(slot="op")
    Button(
      type="primary",
      :to="{ name: 'proms-budgets-create' }",
      v-if="createAllowed"
    ) 发起
  div(slot="content")
    PromsCollapse
      div(slot="panel")
        .query-container
          PromsBudgetSelector(v-model="query.budget")
          Button.submit-btn(@click="handleQueryClick") 查询
        Table(
          border,
          :columns="columns",
          :data="budgetList",
          :loading="budgetLoading"
        )
          template(slot-scope="{ row, index }", slot="index") {{ index + 1 }}
          template(slot-scope="{ row, index }", slot="handleTime") {{ row.gmtModified | moment('YYYY-MM-DD HH:mm:ss') }}
          template(slot-scope="{row, index}", slot="desc")
            span(style="white-space: pre-wrap;") {{ row.desc }}
          template(slot-scope="{row, index}", slot="status") {{ row.newApprove ? NEW_BUDGET_STATUS_DESC_MAP[row.budgetStatus] : BUDGET_STATUS_DESC_MAP[row.budgetStatus] }}
          .op-wrapper(slot-scope="{ row, index }", slot="op")
            .op(v-if="row.ops.some((op) => op === BudgetOp.UPDATE)")
              a(
                href="javascript:void(0);",
                @click="$router.push({ name: 'proms-budgets-update', params: { id: row.id } })"
              ) 发起内容调整
            .op(v-if="row.ops.some((op) => op === BudgetOp.CONFIG)")
              a(
                href="javascript:void(0);",
                @click="$router.push({ name: 'proms-budgets-config', params: { id: row.id } })"
              ) 配置
            .op(v-if="row.ops.some((op) => op === BudgetOp.VIEW)")
              a(
                href="javascript:void(0);",
                @click="$router.push({ name: 'proms-budgets-view', params: { id: row.id } })"
              ) 查看配置
            .op(v-if="row.ops.some((op) => op === BudgetOp.ADJUST)")
              a(
                href="javascript:void(0);",
                @click="$router.push({ name: 'proms-budgets-adjust', params: { id: row.id } })"
              ) 调整
            .op(v-if="row.ops.some((op) => op === BudgetOp.PROGRESS)")
              a(
                href="javascript:void(0);",
                @click="$router.push({ name: 'proms-budgets-progress', params: { id: row.id } })"
              ) 查看进度
            .op(v-if="row.ops.some((op) => op === BudgetOp.LOCK)")
              a(href="javascript:void(0);", @click="handleLock(row)") 锁定
            .op(v-if="row.ops.some((op) => op === BudgetOp.CHECK)")
              a(
                href="javascript:void(0);",
                @click="$router.push({ name: 'proms-budgets-check', params: { id: row.id } })"
              ) 预算审批
            .op(v-if="row.ops.some((op) => op === BudgetOp.LOCK_CHECK)")
              a(
                href="javascript:void(0);",
                @click="$router.push({ name: 'proms-budgets-view', params: { id: row.id } })"
              ) 锁量审批
            .op(v-if="row.ops.some((op) => op === BudgetOp.COMPARE)")
              a(
                href="javascript:void(0);",
                @click="$router.push({ name: 'proms-budgets-comparison', params: { id: row.id } })"
              ) 版本对比
            .op(v-if="row.ops.some((op) => op === BudgetOp.DELETE)")
              a(href="javascript:void(0);", @click="handleDelete(row)") 删除
        .pager-container
          Page(
            :total="pager.total",
            :page-size="pager.pageSize",
            :current.sync="pager.current",
            @on-change="doQuery"
          )
</template>
<script lang="ts">
// @ts-nocheck
import Vue from "vue";
import Component from "vue-class-component";
import { mapState, mapActions, mapGetters } from "vuex";
import qs from "qs";
import axios from "@/pages/proms/services/apiService";
import {
  BudgetStatus,
  BudgetOp,
  PreStatusEnum,
} from "@/typings/models/proms.d.ts";
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

@Component({
  data() {
    return {
      a: "",
      b: {},
      c: () => {},
      d: 123,
    };
  },
  props: {
    name: String,
    favo: [Number, String],
    color: {
      type: String,
      default: "lala",
    },
    arr: {
      type: [String, Number],
      default: "wah",
    },
  },
  computed: {
    ...mapGetters("PROMS_BUDGETS", ["createAllowed"]),
    ...mapState("PROMS_BUDGETS/BUDGET_LIST", [
      "budgetList",
      "pager",
      "budgetLoading",
    ]),
    ...mapState("PROMS_BUDGETS/BUDGET_LIST", {
      queryInStore: "query",
    }),
    name() {
      return "hahah";
    },
    color: {
      get() {},
      set() {},
    },
  },
  methods: {
    ...mapActions("PROMS_BUDGETS/BUDGET_LIST", ["updateQuery", "doQuery"]),
    getClolor() {

    },
    getName: function() {}
  },
  created() {
    this.query = this.queryInStore;
    this.doQuery();
  },
})
export default class BudgetList extends Vue {
  @Prop readonly propA: any;
  @PlanModule.Getter(PLAN_MODULE.GET_LESSON_METHODS) lessonMethods: EnumType;
  BudgetOp: any = BudgetOp;
  BudgetStatus: any = BudgetStatus;
  BUDGET_STATUS_DESC_MAP: any = BUDGET_STATUS_DESC_MAP;
  NEW_BUDGET_STATUS_DESC_MAP = NEW_BUDGET_STATUS_DESC_MAP;
  query: {} = { budget: { name: "", version: "" } };
  columns: { title: string; key?: string; slot?: string; width?: number }[] = [
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
            } else {
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
        const lockModalContent = `请您确定要${
          response.data ? "变更" : ""
        }锁定【${row.budgetName}-${row.version}】吗？`;
        this.$Modal.confirm({
          title: "锁定",
          content: `${lockModalContent}`,
          width: "500",
          onOk: () => {
            axios
              .post(
                "budgetlock/lockBudget",
                qs.stringify({ budgetId: row.id }),
                { loading: true } as any
              )
              .then(({ data }) => {
                if (data) {
                  this.$Message.success(
                    `${isLocked ? "变更" : ""}锁定操作成功`
                  );
                  (this as any).doQuery();
                } else {
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
}
</script>
<style lang="scss" scoped>
.budget-list {
  .query-container {
    display: flex;
    flex-wrap: wrap;
    > * {
      margin-bottom: 16px;
    }
    .submit-btn {
      margin-left: 48px;
    }
  }
  .op-wrapper {
    display: flex;
    .op {
      padding: 0 6px;
      &:not(:last-child) {
        border-right: 1px solid #eee;
      }
      a {
        color: #1790ff;
      }
    }
  }
  .pager-container {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }
}
.lock-modal-content {
  text-align: center;
  font-size: 16px;
}
</style>
